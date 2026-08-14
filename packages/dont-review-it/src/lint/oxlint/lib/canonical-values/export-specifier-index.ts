import { realpathSync } from "node:fs";
import { join, relative } from "node:path";

import { attempt, sortBy, uniq } from "es-toolkit";
import * as ts from "typescript-6";

import { pathIsInside } from "../path-is-inside.ts";
import { toPosixPath } from "../posix-path.ts";
import {
  packageExportPatternCaptures,
  packageExportSourceFile,
  packageExportTargetPatterns,
  singleWildcardPattern,
  substitutePackageExportPattern,
  validPackageExportTargetPattern,
  winningPackageExportSubpath,
} from "./package-export-target.ts";
import { EXPORTS_CONDITION_DEPTH_LIMIT, MANIFEST_FILE_NAME } from "./package-manifest.ts";
import { readJsonFile } from "./read-json-file.ts";
import { listRepositoryFiles } from "./source-files.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

import type { CanonicalValuesImportRoute } from "./catalog.ts";

const realPathIsInside = (parent: string, candidate: string): boolean => {
  const [failure, paths] = attempt(() => ({
    candidate: realpathSync.native(candidate),
    parent: realpathSync.native(parent),
  }));
  return failure === null && paths !== null && pathIsInside(paths.parent, paths.candidate);
};

type ResolvedTarget = {
  readonly exhaustive: boolean;
  readonly sourceFiles: readonly string[];
};

const unresolvedTarget = (): ResolvedTarget => ({ exhaustive: false, sourceFiles: [] });

const resolvedStringTarget = ({
  packageDirectory,
  target,
}: {
  readonly packageDirectory: string;
  readonly target: string;
}): ResolvedTarget => {
  if (!target.startsWith("./") || /\.d\.[cm]?ts$/u.test(target)) return unresolvedTarget();
  const sourceFile = packageExportSourceFile(packageDirectory, target);
  return sourceFile === null || !realPathIsInside(packageDirectory, sourceFile)
    ? unresolvedTarget()
    : { exhaustive: true, sourceFiles: [sourceFile] };
};

const combineTargets = (left: ResolvedTarget, right: ResolvedTarget): ResolvedTarget => ({
  exhaustive: right.exhaustive,
  sourceFiles: uniq([...left.sourceFiles, ...right.sourceFiles]),
});

const resolvedArrayTarget = ({
  depth,
  packageDirectory,
  alternatives,
}: {
  readonly depth: number;
  readonly packageDirectory: string;
  readonly alternatives: readonly unknown[];
}): ResolvedTarget => {
  const [alternative, ...remaining] = alternatives;
  if (alternative === undefined) return unresolvedTarget();
  const resolved = resolvedTarget({ depth: depth + 1, packageDirectory, value: alternative });
  if (resolved.exhaustive) return resolved;
  return combineTargets(
    resolved,
    resolvedArrayTarget({ depth, packageDirectory, alternatives: remaining }),
  );
};

const resolvedConditionTarget = ({
  conditions,
  depth,
  packageDirectory,
}: {
  readonly conditions: readonly [string, unknown][];
  readonly depth: number;
  readonly packageDirectory: string;
}): ResolvedTarget => {
  const [conditionBranch, ...remaining] = conditions;
  if (conditionBranch === undefined) return { exhaustive: true, sourceFiles: [] };
  const [condition, branchTarget] = conditionBranch;
  if (/^types(?:@|$)/u.test(condition) || branchTarget === null) {
    return resolvedConditionTarget({ conditions: remaining, depth, packageDirectory });
  }
  const resolved = resolvedTarget({ depth: depth + 1, packageDirectory, value: branchTarget });
  if (condition === "default") return resolved;
  const rest = resolvedConditionTarget({ conditions: remaining, depth, packageDirectory });
  return {
    exhaustive: resolved.exhaustive && rest.exhaustive,
    sourceFiles: uniq([...resolved.sourceFiles, ...rest.sourceFiles]),
  };
};

const resolvedTarget = ({
  depth,
  packageDirectory,
  value,
}: {
  readonly depth: number;
  readonly packageDirectory: string;
  readonly value: unknown;
}): ResolvedTarget => {
  if (typeof value === "string") {
    return resolvedStringTarget({ packageDirectory, target: value });
  }
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT || value === null || typeof value !== "object") {
    return unresolvedTarget();
  }
  if (Array.isArray(value)) {
    return resolvedArrayTarget({ depth, packageDirectory, alternatives: value });
  }
  return resolvedConditionTarget({
    conditions: Object.entries(value),
    depth,
    packageDirectory,
  });
};

const packageSpecifier = (packageName: string, subpath: string): string =>
  subpath === "." ? packageName : `${packageName}/${subpath.replace(/^\.\//u, "")}`;

const patternSurfaces = ({
  packageDirectory,
  packageName,
  repositoryFiles,
  subpath,
  subpaths,
  target,
}: {
  readonly packageDirectory: string;
  readonly packageName: string;
  readonly repositoryFiles: readonly string[];
  readonly subpath: string;
  readonly subpaths: readonly string[];
  readonly target: unknown;
}): readonly { readonly sourceFiles: readonly string[]; readonly specifier: string }[] => {
  if (singleWildcardPattern(subpath) === null) return [];
  const allTargets = packageExportTargetPatterns({
    depth: 0,
    includeTypes: true,
    value: target,
  });
  const runtimeTargets = packageExportTargetPatterns({
    depth: 0,
    includeTypes: false,
    value: target,
  });
  if (
    allTargets === null ||
    runtimeTargets === null ||
    allTargets.length === 0 ||
    runtimeTargets.length === 0 ||
    !allTargets.every((pattern) => validPackageExportTargetPattern(packageDirectory, pattern))
  ) {
    return [];
  }
  return packageExportPatternCaptures({
    packageDirectory,
    repositoryFiles,
    targets: runtimeTargets,
  }).flatMap((capture) => {
    const exportedSubpath = subpath.replace("*", capture);
    if (winningPackageExportSubpath(subpaths, exportedSubpath) !== subpath) return [];
    const resolved = resolvedTarget({
      depth: 0,
      packageDirectory,
      value: substitutePackageExportPattern(target, capture),
    });
    return resolved.exhaustive && resolved.sourceFiles.length !== 0
      ? [
          {
            sourceFiles: resolved.sourceFiles,
            specifier: packageSpecifier(packageName, exportedSubpath),
          },
        ]
      : [];
  });
};

const packageSurfaces = ({
  exportsField,
  packageDirectory,
  packageName,
}: {
  readonly exportsField: unknown;
  readonly packageDirectory: string;
  readonly packageName: string;
}) => {
  const subpaths =
    exportsField !== null &&
    typeof exportsField === "object" &&
    !Array.isArray(exportsField) &&
    Object.keys(exportsField).some((subpathKey) => subpathKey.startsWith("."))
      ? Object.entries(exportsField)
      : [[".", exportsField] as const];

  const repositoryFiles = subpaths.some(([subpath]) => subpath.includes("*"))
    ? listRepositoryFiles(packageDirectory).cacheInputs.map((file) => file.absolutePath)
    : [];
  const subpathKeys = subpaths.map(([subpath]) => subpath);

  return subpaths.flatMap(([subpath, exportTarget]) => {
    if ((subpath !== "." && !subpath.startsWith("./")) || subpath === `./${MANIFEST_FILE_NAME}`) {
      return [];
    }
    if (subpath.includes("*")) {
      return patternSurfaces({
        packageDirectory,
        packageName,
        repositoryFiles,
        subpath,
        subpaths: subpathKeys,
        target: exportTarget,
      });
    }
    const resolved = resolvedTarget({ depth: 0, packageDirectory, value: exportTarget });
    if (!resolved.exhaustive) return [];
    const { sourceFiles } = resolved;
    return sourceFiles.length === 0
      ? []
      : [{ sourceFiles, specifier: packageSpecifier(packageName, subpath) }];
  });
};

type PackageManifest = Readonly<Record<string, unknown>> & { readonly name: string };

const packageManifest = (packageDirectory: string): PackageManifest | null => {
  const manifest = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("name" in manifest) ||
    typeof manifest.name !== "string" ||
    manifest.name.length === 0
  ) {
    return null;
  }
  return manifest as PackageManifest;
};

export const publicPackageEntries = (
  packageDirectory: string,
): readonly { readonly sourceFile: string; readonly specifier: string }[] => {
  const manifest = packageManifest(packageDirectory);
  if (manifest === null) return [];
  const packageName = manifest.name;

  const exportsField = "exports" in manifest ? manifest.exports : undefined;
  return packageSurfaces({ exportsField, packageDirectory, packageName }).flatMap((surface) =>
    surface.sourceFiles.map((sourceFile) => ({ sourceFile, specifier: surface.specifier })),
  );
};

export const publicPackageName = (packageDirectory: string): string | null => {
  return packageManifest(packageDirectory)?.name ?? null;
};

const declarationIdentity = (declaration: ts.Declaration): string =>
  `${declaration.getSourceFile().fileName}:${declaration.pos}:${declaration.end}`;

const declaresSameBinding = (left: ts.Symbol, right: ts.Symbol): boolean => {
  if (left === right) return true;
  const leftDeclarations = new Set(
    (left.declarations as readonly ts.Declaration[]).map(declarationIdentity),
  );
  return (right.declarations as readonly ts.Declaration[]).some((declaration) =>
    leftDeclarations.has(declarationIdentity(declaration)),
  );
};

const MODULE_VALUE_EXPORT_NAME = "<module>";

const ownerExportNames = ({
  checker,
  fileName,
  owner,
  program,
}: {
  readonly checker: ts.TypeChecker;
  readonly fileName: string;
  readonly owner: ts.Symbol;
  readonly program: ts.Program;
}): readonly string[] => {
  const sourceFile = program.getSourceFile(fileName) as ts.SourceFile;
  const module = checker.getSymbolAtLocation(sourceFile);
  if (module === undefined) return [];
  const namedExports = checker
    .getExportsOfModule(module)
    .filter((exported) => declaresSameBinding(resolveTypeScriptSymbol(checker, exported), owner))
    .map((exported) => exported.name);
  const moduleValue = module.exports?.get(ts.InternalSymbolName.ExportEquals);
  return moduleValue !== undefined &&
    declaresSameBinding(resolveTypeScriptSymbol(checker, moduleValue), owner)
    ? uniq([...namedExports, MODULE_VALUE_EXPORT_NAME])
    : namedExports;
};

const sharedExportNames = ([firstExportNames, ...remaining]: readonly [
  readonly string[],
  ...(readonly string[])[],
]): readonly string[] => {
  return firstExportNames.filter((exportName) =>
    remaining.every((exportNames) => exportNames.includes(exportName)),
  );
};

export const publicImportRoutes = ({
  checker,
  owner,
  packageDirectory,
  program,
  repositoryRoot,
}: {
  readonly checker: ts.TypeChecker;
  readonly owner: ts.Symbol;
  readonly packageDirectory: string;
  readonly program: ts.Program;
  readonly repositoryRoot: string;
}): readonly CanonicalValuesImportRoute[] => {
  const manifest = packageManifest(packageDirectory);
  if (manifest === null) return [];
  const packageName = manifest.name;
  const exportsField = manifest.exports;

  const routes = packageSurfaces({ exportsField, packageDirectory, packageName }).flatMap(
    (surface) => {
      const exportNamesBySource = surface.sourceFiles.map((fileName) =>
        ownerExportNames({ checker, fileName, owner, program }),
      );
      const resolvedSourcePaths = surface.sourceFiles
        .map((fileName) => toPosixPath(relative(repositoryRoot, fileName)))
        .toSorted();
      const [firstExportNames, ...remainingExportNames] = exportNamesBySource;
      return sharedExportNames([
        firstExportNames as readonly string[],
        ...remainingExportNames,
      ]).map((exportName) => ({
        exportName,
        resolvedSourcePaths,
        specifier: surface.specifier,
      }));
    },
  );

  const unique = new Map(routes.map((route) => [`${route.specifier}\0${route.exportName}`, route]));
  return sortBy([...unique.values()], ["specifier", "exportName"]);
};
