import { dirname } from "node:path";

import { measureStage } from "@mst/lint-rule-authoring";
import { attempt, groupBy, uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import {
  publicImportRoutes,
  publicPackageEntries,
  publicPackageName,
} from "./export-specifier-index.ts";
import { canonicalValueKey, fingerprintValues, type CanonicalValue } from "./fingerprint.ts";
import { nearestPackageDirectory } from "./source-files.ts";
import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "./typescript-program.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValuesDeclaration, CanonicalValuesTextProblem } from "./declarations.ts";

export type CanonicalValuesDeclarationSite = CanonicalValuesDeclaration & {
  readonly absolutePath: string;
  readonly relativePath: string;
};

export type CanonicalValuesSourceProblem = CanonicalValuesTextProblem extends infer Problem
  ? Problem extends CanonicalValuesTextProblem
    ? Problem & { readonly filePath: string }
    : never
  : never;

const variableDeclarationAt = (
  sourceFile: ts.SourceFile,
  declaration: CanonicalValuesDeclarationSite,
): ts.VariableDeclaration => {
  const statement = sourceFile.statements.find(
    (candidate) => candidate.getStart(sourceFile) === declaration.declarationStart,
  ) as ts.VariableStatement;
  return statement.declarationList.declarations[0] as ts.VariableDeclaration;
};

const normalizedItems = (canonicalItems: readonly CanonicalValue[]): readonly CanonicalValue[] =>
  uniqBy(canonicalItems, canonicalValueKey).toSorted((left, right) =>
    canonicalValueKey(left).localeCompare(canonicalValueKey(right)),
  );

const literalValueFromType = (
  checker: ts.TypeChecker,
  literalType: ts.Type,
): CanonicalValue | undefined => {
  if ((literalType.flags & ts.TypeFlags.StringLiteral) !== 0)
    return (literalType as ts.StringLiteralType).value;
  if ((literalType.flags & ts.TypeFlags.NumberLiteral) !== 0)
    return (literalType as ts.NumberLiteralType).value;
  if ((literalType.flags & ts.TypeFlags.BooleanLiteral) !== 0)
    return checker.typeToString(literalType) === "true";
  return (literalType.flags & ts.TypeFlags.Null) !== 0 ? null : undefined;
};

const objectDomain = (input: {
  readonly bindingType: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
}): readonly CanonicalValue[] => {
  if ((input.bindingType.flags & ts.TypeFlags.Object) === 0) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical binding must expose finite values`,
    );
  }
  if (input.checker.getIndexInfosOfType(input.bindingType).length > 0) {
    throw new Error(`${input.declaration.name.getText()}: canonical object keys must be closed`);
  }
  const properties = input.checker.getPropertiesOfType(input.bindingType);
  if (
    properties.length === 0 ||
    properties.some(
      (property) =>
        (property.flags & ts.SymbolFlags.Optional) !== 0 || property.name.startsWith("__@"),
    )
  ) {
    throw new Error(`${input.declaration.name.getText()}: canonical object keys must be finite`);
  }
  return normalizedItems(properties.map((property) => property.name));
};

const arrayDomain = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly elementType: ts.Type;
}): readonly CanonicalValue[] => {
  if ((input.elementType.flags & ts.TypeFlags.Never) !== 0) {
    throw new Error(`${input.declaration.name.getText()}: canonical array must not be empty`);
  }
  const memberTypes = input.elementType.isUnion() ? input.elementType.types : [input.elementType];
  const canonicalItems = memberTypes.map((member) => literalValueFromType(input.checker, member));
  if (
    canonicalItems.length === 0 ||
    canonicalItems.some((canonicalItem) => canonicalItem === undefined)
  ) {
    throw new Error(`${input.declaration.name.getText()}: canonical array must contain literals`);
  }
  return normalizedItems(canonicalItems as CanonicalValue[]);
};

const unwrapInitializer = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapInitializer(expression.expression);
  }
  return expression;
};

const directScalarInitializerValue = (unwrapped: ts.Expression): CanonicalValue | undefined => {
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text);
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (unwrapped.kind === ts.SyntaxKind.NullKeyword) return null;
  return undefined;
};

const directInitializerValue = (expression: ts.Expression): CanonicalValue | undefined => {
  const unwrapped = unwrapInitializer(expression);
  const scalar = directScalarInitializerValue(unwrapped);
  if (scalar !== undefined) return scalar;
  if (!ts.isPrefixUnaryExpression(unwrapped)) return undefined;
  if (
    unwrapped.operator !== ts.SyntaxKind.PlusToken &&
    unwrapped.operator !== ts.SyntaxKind.MinusToken
  ) {
    return undefined;
  }
  const operand = directInitializerValue(unwrapped.operand);
  if (typeof operand !== "number") return undefined;
  return unwrapped.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
};

const validateDirectDuplicates = (declaration: ts.VariableDeclaration): void => {
  const unwrapped = unwrapInitializer(declaration.initializer as ts.Expression);
  if (!ts.isArrayLiteralExpression(unwrapped)) return;
  const directItems = unwrapped.elements.flatMap((arrayElement) => {
    if (ts.isSpreadElement(arrayElement) || ts.isOmittedExpression(arrayElement)) return [];
    const canonicalItem = directInitializerValue(arrayElement);
    return canonicalItem === undefined ? [] : [canonicalItem];
  });
  const literalKeys = directItems.map(canonicalValueKey);
  if (new Set(literalKeys).size !== literalKeys.length) {
    throw new Error(`${declaration.name.getText()}: canonical array contains duplicate values`);
  }
};

const canonicalItemsFromType = (
  checker: ts.TypeChecker,
  declaration: ts.VariableDeclaration,
): readonly CanonicalValue[] => {
  validateDirectDuplicates(declaration);
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

const entryFor = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: CanonicalValuesDeclarationSite;
  readonly program: ts.Program;
  readonly repositoryRoot: string;
}): CanonicalValuesEntry => {
  const sourceFile = input.program.getSourceFile(input.declaration.absolutePath) as ts.SourceFile;
  const variable = variableDeclarationAt(sourceFile, input.declaration);
  const owner = input.checker.getSymbolAtLocation(variable.name) as ts.Symbol;
  const canonicalItems = canonicalItemsFromType(input.checker, variable);
  const surface = packageSurface({ ...input, owner });
  return {
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
  };
};

const publicSourceFilesFor = (
  declarations: readonly CanonicalValuesDeclarationSite[],
  repositoryRoot: string,
): readonly string[] =>
  uniqBy(
    declarations.flatMap((declaration) => {
      const packageDirectory = nearestPackageDirectory(
        dirname(declaration.absolutePath),
        repositoryRoot,
      );
      if (packageDirectory === null) return [];
      const [failure, packageExports] = attempt(() => publicPackageEntries(packageDirectory));
      return failure === null && packageExports !== null
        ? packageExports.map((packageExport) => packageExport.sourceFile)
        : [];
    }),
    (sourceFile) => sourceFile,
  );

const problemFor = (declaration: CanonicalValuesDeclarationSite): CanonicalValuesSourceProblem => ({
  kind: "vocabulary-without-values",
  filePath: declaration.relativePath,
  line: declaration.line,
  conceptId: declaration.conceptId,
});

const configurationKey = (
  declaration: CanonicalValuesDeclarationSite,
  repositoryRoot: string,
): string =>
  canonicalValuesTypeScriptConfigPath({
    repositoryRoot,
    searchDirectory: dirname(declaration.absolutePath),
  }) ?? "<default>";

const resolveGroup = (input: {
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly publicSourceFiles: readonly string[];
  readonly repositoryRoot: string;
}): {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly problems: readonly CanonicalValuesSourceProblem[];
} => {
  const first = input.declarations[0] as CanonicalValuesDeclarationSite;
  const program = createCanonicalValuesTypeScriptProgram({
    repositoryRoot: input.repositoryRoot,
    rootNames: [
      ...input.declarations.map((declaration) => declaration.absolutePath),
      ...input.publicSourceFiles,
    ],
    searchDirectory: dirname(first.absolutePath),
  });
  const checker = measureStage("canonical.checker", () => program.getTypeChecker());
  const measuredEntry = (declaration: CanonicalValuesDeclarationSite): CanonicalValuesEntry =>
    measureStage("canonical.entry", () =>
      entryFor({ checker, declaration, program, repositoryRoot: input.repositoryRoot }),
    );
  const resolutions = input.declarations.map((declaration) => {
    const [failure, declarationEntry] = attempt(() => measuredEntry(declaration));
    return failure === null && declarationEntry !== null
      ? { entry: declarationEntry, problem: null }
      : { entry: null, problem: problemFor(declaration) };
  });
  return {
    entries: resolutions.flatMap((resolution) =>
      resolution.entry === null ? [] : [resolution.entry],
    ),
    problems: resolutions.flatMap((resolution) =>
      resolution.problem === null ? [] : [resolution.problem],
    ),
  };
};

export const resolveCanonicalValuesEntries = (input: {
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly repositoryRoot: string;
}): {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly problems: readonly CanonicalValuesSourceProblem[];
} => {
  const publicSourceFiles = publicSourceFilesFor(input.declarations, input.repositoryRoot);
  const configurationGroups = Object.values(
    groupBy(input.declarations, (declaration) =>
      configurationKey(declaration, input.repositoryRoot),
    ),
  );
  const resolvedGroups = configurationGroups.map((declarations) =>
    resolveGroup({ ...input, declarations, publicSourceFiles }),
  );
  return {
    entries: resolvedGroups.flatMap((resolution) => resolution.entries),
    problems: resolvedGroups.flatMap((resolution) => resolution.problems),
  };
};
