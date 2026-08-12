import { dirname } from "node:path";

import { attempt, uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import { canonicalOwnerReachableNodes } from "./canonical-owner-execution.ts";
import { validateCanonicalOwnerRuntimeDomain } from "./canonical-owner-runtime-domain.ts";
import {
  canonicalOwnerRuntimeDeclarationKey,
  validateCanonicalOwnerRuntimeSource,
} from "./canonical-owner-runtime-source.ts";
import { validateCanonicalOwnerStability } from "./canonical-owner-stability.ts";
import {
  canonicalValueFromLiteralType,
  validateDirectCanonicalValueDuplicates,
} from "./direct-duplicate-values.ts";
import {
  publicImportRoutes,
  publicPackageEntries,
  publicPackageName,
} from "./export-specifier-index.ts";
import { canonicalValueKey, fingerprintValues, type CanonicalValue } from "./fingerprint.ts";
import { nearestPackageDirectory } from "./source-files.ts";
import { createCanonicalValuesTypeScriptProgram } from "./typescript-program.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValuesDeclaration, CanonicalValuesTextProblem } from "./declarations.ts";

export type CanonicalValuesDeclarationSite = CanonicalValuesDeclaration & {
  readonly absolutePath: string;
  readonly relativePath: string;
};

export type CanonicalValuesSourceProblem = CanonicalValuesTextProblem & {
  readonly filePath: string;
};

const variableDeclarationAt = (
  sourceFile: ts.SourceFile,
  declaration: CanonicalValuesDeclarationSite,
): ts.VariableDeclaration => {
  const statement = sourceFile.statements.find(
    (candidate) => candidate.getStart(sourceFile) === declaration.declarationStart,
  );
  if (statement === undefined || !ts.isVariableStatement(statement)) {
    throw new Error(`${declaration.relativePath}: canonical variable statement was not found`);
  }
  const [variable] = statement.declarationList.declarations;
  if (
    statement.declarationList.declarations.length !== 1 ||
    variable === undefined ||
    !ts.isIdentifier(variable.name) ||
    variable.name.text !== declaration.binding
  ) {
    throw new Error(`${declaration.relativePath}: canonical binding was not found`);
  }
  return variable;
};

const normalizedItems = (canonicalItems: readonly CanonicalValue[]): readonly CanonicalValue[] =>
  uniqBy(canonicalItems, canonicalValueKey).toSorted((left, right) =>
    canonicalValueKey(left).localeCompare(canonicalValueKey(right)),
  );

const closedObjectProperties = (input: {
  readonly bindingType: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
}): readonly ts.Symbol[] => {
  if ((input.bindingType.flags & ts.TypeFlags.Object) === 0) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical binding must expose finite values`,
    );
  }
  if (input.checker.getIndexInfosOfType(input.bindingType).length > 0) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical object keys must form a closed domain`,
    );
  }
  const properties = input.checker.getPropertiesOfType(input.bindingType);
  if (properties.some((property) => (property.flags & ts.SymbolFlags.Optional) !== 0)) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical object keys must always be present`,
    );
  }
  return properties;
};

const objectDomain = (input: {
  readonly bindingType: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
}): readonly CanonicalValue[] => {
  const properties = closedObjectProperties(input);
  const propertyNames = properties.map((property) => property.name);
  if (propertyNames.length === 0 || propertyNames.some((name) => name.startsWith("__@"))) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical object must expose named properties`,
    );
  }
  return normalizedItems(propertyNames);
};

const arrayDomain = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly elementType: ts.Type;
}): readonly CanonicalValue[] => {
  const memberTypes = input.elementType.isUnion() ? input.elementType.types : [input.elementType];
  const canonicalItems = memberTypes.map((member) =>
    canonicalValueFromLiteralType(input.checker, member),
  );
  if (canonicalItems.length === 0 || canonicalItems.some((item) => item === undefined)) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical array must expose literal values`,
    );
  }
  return normalizedItems(canonicalItems as CanonicalValue[]);
};

const canonicalItemsFromType = (
  checker: ts.TypeChecker,
  declaration: ts.VariableDeclaration,
): readonly CanonicalValue[] => {
  const bindingType = checker.getTypeAtLocation(declaration.name);
  const elementType = checker.getIndexTypeOfType(bindingType, ts.IndexKind.Number);
  return elementType === undefined
    ? objectDomain({ bindingType, checker, declaration })
    : arrayDomain({ checker, declaration, elementType });
};

const packageSurface = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly owner: ts.Symbol;
  readonly program: ts.Program;
  readonly repositoryRoot: string;
}): Pick<CanonicalValuesEntry, "importRoutes" | "packageName"> => {
  const packageDirectory = nearestPackageDirectory(
    dirname(input.declaration.absolutePath),
    input.repositoryRoot,
  );
  if (packageDirectory === null) return { importRoutes: [], packageName: null };
  return {
    importRoutes: publicImportRoutes({
      checker: input.checker,
      owner: input.owner,
      packageDirectory,
      program: input.program,
      repositoryRoot: input.repositoryRoot,
    }),
    packageName: publicPackageName(packageDirectory),
  };
};

const ownerBindingFor = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly program: ts.Program;
}): { readonly owner: ts.Symbol; readonly variable: ts.VariableDeclaration } => {
  const sourceFile = input.program.getSourceFile(input.declaration.absolutePath);
  if (sourceFile === undefined) {
    throw new Error(`${input.declaration.relativePath}: TypeScript program did not load the owner`);
  }
  const variable = variableDeclarationAt(sourceFile, input.declaration);
  const owner = input.checker.getSymbolAtLocation(variable.name);
  if (owner === undefined) {
    throw new Error(
      `${input.declaration.relativePath}: TypeScript did not resolve the owner binding`,
    );
  }
  return { owner, variable };
};

const entryFor = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly program: ts.Program;
  readonly repositoryRoot: string;
}): { readonly dependencies: readonly string[]; readonly entry: CanonicalValuesEntry } => {
  const { owner, variable } = ownerBindingFor(input);
  const nodes = canonicalOwnerReachableNodes(input.program, input.checker);
  validateCanonicalOwnerStability({
    checker: input.checker,
    declaration: variable,
    nodes,
    owner,
    program: input.program,
  });
  validateDirectCanonicalValueDuplicates(input.checker, variable);
  const canonicalItems = canonicalItemsFromType(input.checker, variable);
  validateCanonicalOwnerRuntimeDomain({
    checker: input.checker,
    declaration: variable,
    expectedValues: canonicalItems,
    nodes,
    program: input.program,
  });
  const dependencies = validateCanonicalOwnerRuntimeSource({
    checker: input.checker,
    declaration: variable,
    declarations: input.declarations,
    nodes,
    program: input.program,
    repositoryRoot: input.repositoryRoot,
  });
  const surface = packageSurface({ ...input, owner });
  return {
    dependencies,
    entry: {
      annotationStart: input.declaration.annotationStart,
      binding: input.declaration.binding,
      bindingStart: input.declaration.bindingStart,
      conceptId: input.declaration.conceptId,
      declarationEnd: input.declaration.declarationEnd,
      declarationPath: input.declaration.relativePath,
      declarationStart: input.declaration.declarationStart,
      importRoutes: surface.importRoutes,
      packageName: surface.packageName,
      values: canonicalItems,
      fingerprint: fingerprintValues(canonicalItems),
    },
  };
};

const publicSourceFilesFor = (
  declarations: readonly CanonicalValuesDeclarationSite[],
  repositoryRoot: string,
): readonly string[] => {
  const packageDirectories = uniqBy(
    declarations.flatMap((declaration) => {
      const directory = nearestPackageDirectory(dirname(declaration.absolutePath), repositoryRoot);
      return directory === null ? [] : [directory];
    }),
    (directory) => directory,
  );
  return packageDirectories.flatMap((packageDirectory) => {
    const [failure, entries] = attempt(() => publicPackageEntries(packageDirectory));
    if (failure !== null || entries === null) return [];
    return entries.map((entry) => entry.sourceFile);
  });
};

const problemFor = (declaration: CanonicalValuesDeclarationSite): CanonicalValuesSourceProblem => ({
  kind: "vocabulary-without-values",
  filePath: declaration.relativePath,
  line: declaration.line,
  conceptId: declaration.conceptId,
});

const resolveDeclaration = (input: {
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly publicSourceFiles: readonly string[];
  readonly repositoryRoot: string;
  readonly sourceFiles: readonly string[];
}): {
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly dependencies: readonly string[];
  readonly entry: CanonicalValuesEntry | null;
  readonly problem: CanonicalValuesSourceProblem | null;
} => {
  const [failure, resolved] = attempt(() => {
    const program = createCanonicalValuesTypeScriptProgram({
      repositoryRoot: input.repositoryRoot,
      rootNames: [input.declaration.absolutePath, ...input.publicSourceFiles, ...input.sourceFiles],
      searchDirectory: dirname(input.declaration.absolutePath),
    });
    return entryFor({
      checker: program.getTypeChecker(),
      declaration: input.declaration,
      declarations: input.declarations,
      program,
      repositoryRoot: input.repositoryRoot,
    });
  });
  return failure === null && resolved !== null
    ? {
        declaration: input.declaration,
        dependencies: resolved.dependencies,
        entry: resolved.entry,
        problem: null,
      }
    : {
        declaration: input.declaration,
        dependencies: [],
        entry: null,
        problem: problemFor(input.declaration),
      };
};

type ResolvedDeclaration = ReturnType<typeof resolveDeclaration>;

const declarationKey = (declaration: CanonicalValuesDeclarationSite): string =>
  canonicalOwnerRuntimeDeclarationKey(declaration);

const entriesWithResolvedDependencies = (
  results: readonly ResolvedDeclaration[],
): readonly ResolvedDeclaration[] => {
  const successful = results.filter((result) => result.entry !== null);
  const complete = (remaining: readonly ResolvedDeclaration[]): readonly ResolvedDeclaration[] => {
    const keys = new Set(remaining.map((result) => declarationKey(result.declaration)));
    const next = remaining.filter((result) =>
      result.dependencies.every((dependency) => keys.has(dependency)),
    );
    return next.length === remaining.length ? next : complete(next);
  };
  return complete(successful);
};

export const resolveCanonicalValuesEntries = (input: {
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly repositoryRoot: string;
  readonly sourceFiles: readonly string[];
}): {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly problems: readonly CanonicalValuesSourceProblem[];
} => {
  const publicSourceFiles = publicSourceFilesFor(input.declarations, input.repositoryRoot);
  const results = input.declarations.map((declaration) =>
    resolveDeclaration({
      declaration,
      declarations: input.declarations,
      publicSourceFiles,
      repositoryRoot: input.repositoryRoot,
      sourceFiles: input.sourceFiles,
    }),
  );
  const resolved = entriesWithResolvedDependencies(results);
  const resolvedKeys = new Set(resolved.map((result) => declarationKey(result.declaration)));
  return {
    entries: resolved.flatMap((result) => (result.entry === null ? [] : [result.entry])),
    problems: results.flatMap((result) => {
      if (result.problem !== null) return [result.problem];
      return resolvedKeys.has(declarationKey(result.declaration))
        ? []
        : [problemFor(result.declaration)];
    }),
  };
};
