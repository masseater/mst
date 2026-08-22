import { readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { attempt } from "es-toolkit";
import * as ts from "typescript-6";

import { pathIsInside } from "../path-is-inside.ts";
import {
  realPathOf,
  repositoryModuleLocation,
  type RepositoryModuleLocation,
} from "./import-route-source-identity.ts";
import { isRelativeImportSpecifier } from "./import-specifier.ts";

import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
  CanonicalValuesImportRoute,
} from "./catalog.ts";

export type ImportRouteQuery = {
  readonly importedName: string;
  readonly specifier: string;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly resolutionMode?: ts.ResolutionMode;
};

const IMPORT_MODULE_RESOLUTION_MODE: NonNullable<ts.ResolutionMode> = ts.ModuleKind.ESNext;

type ResolvedModuleLocation = RepositoryModuleLocation | { readonly kind: "unresolved" };

const containingFileOf = (query: ImportRouteQuery): string =>
  resolve(query.repositoryRoot, query.filename);

const configPathAtOrAbove = (input: {
  readonly configName: "jsconfig.json" | "tsconfig.json";
  readonly directory: string;
  readonly repositoryRoot: string;
}): string | undefined => {
  if (!pathIsInside(input.repositoryRoot, input.directory)) return undefined;
  const candidate = resolve(input.directory, input.configName);
  if (ts.sys.fileExists(candidate)) return candidate;
  if (input.directory === input.repositoryRoot) return undefined;
  return configPathAtOrAbove({ ...input, directory: dirname(input.directory) });
};

const parsedCompilerOptions = (configPath: string): ts.CompilerOptions | null => {
  const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  if (read.error !== undefined) return null;
  return ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath)).options;
};

const compilerOptionsFor = (
  query: ImportRouteQuery,
): { readonly containingFile: string; readonly options: ts.CompilerOptions } => {
  const containingFile = containingFileOf(query);
  const repositoryRoot = realPathOf(query.repositoryRoot);
  const directory = realPathOf(dirname(containingFile));
  const configPath =
    configPathAtOrAbove({ configName: "tsconfig.json", directory, repositoryRoot }) ??
    configPathAtOrAbove({ configName: "jsconfig.json", directory, repositoryRoot });
  const compilerOptions =
    configPath === undefined
      ? { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext }
      : parsedCompilerOptions(configPath);
  return { containingFile, options: compilerOptions ?? {} };
};

const repositoryLocation = (
  query: ImportRouteQuery,
  resolvedPath: string,
): RepositoryModuleLocation =>
  repositoryModuleLocation({ repositoryRoot: query.repositoryRoot, resolvedPath });

const fileUrlLocation = (query: ImportRouteQuery): ResolvedModuleLocation | null => {
  if (!query.specifier.startsWith("file:")) return null;
  const [failure, path] = attempt(() => fileURLToPath(query.specifier));
  return failure === null && path !== null
    ? repositoryLocation(query, path)
    : { kind: "unresolved" };
};

type CompilerResolution = ReturnType<typeof compilerOptionsFor>;

const typescriptModuleLocation = (
  query: ImportRouteQuery,
  resolution: CompilerResolution,
): ResolvedModuleLocation | null => {
  const resolvedModule = ts.resolveModuleName(
    query.specifier,
    resolution.containingFile,
    resolution.options,
    ts.sys,
    undefined,
    undefined,
    query.resolutionMode ?? IMPORT_MODULE_RESOLUTION_MODE,
  ).resolvedModule;
  return resolvedModule === undefined
    ? null
    : repositoryLocation(query, resolvedModule.resolvedFileName);
};

const relativeModuleLocation = (
  query: ImportRouteQuery,
  resolution: CompilerResolution,
): ResolvedModuleLocation => {
  if (!isRelativeImportSpecifier(query.specifier) && !isAbsolute(query.specifier)) {
    return { kind: "unresolved" };
  }
  const base = isAbsolute(query.specifier)
    ? query.specifier
    : resolve(dirname(resolution.containingFile), query.specifier);
  const extensions = extname(base) === "" ? [".ts", ".tsx", ".mts", ".cts"] : [""];
  const candidate = extensions
    .map((extension) => `${base}${extension}`)
    .find((path) => ts.sys.fileExists(path));
  return candidate === undefined ? { kind: "unresolved" } : repositoryLocation(query, candidate);
};

const resolvedModuleLocation = (query: ImportRouteQuery): ResolvedModuleLocation => {
  const fileUrl = fileUrlLocation(query);
  if (fileUrl !== null) return fileUrl;
  const resolution = compilerOptionsFor(query);
  return typescriptModuleLocation(query, resolution) ?? relativeModuleLocation(query, resolution);
};

const matchesPathPattern = (specifier: string, pattern: string): boolean => {
  const wildcard = pattern.indexOf("*");
  if (wildcard === -1) return specifier === pattern;
  if (pattern.includes("*", wildcard + 1)) return false;
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix);
};

export const matchesConfiguredPathAlias = (query: ImportRouteQuery): boolean => {
  const resolution = compilerOptionsFor(query);
  return Object.keys(resolution.options.paths ?? {}).some((pattern) =>
    matchesPathPattern(query.specifier, pattern),
  );
};

export const repositoryModulePath = (query: ImportRouteQuery): string | null => {
  const location = resolvedModuleLocation(query);
  return location.kind === "repository" ? location.path : null;
};

export const isIgnoredRepositoryModule = (
  query: ImportRouteQuery,
  catalog: CanonicalValuesCatalog,
): boolean => {
  const location = resolvedModuleLocation(query);
  return location.kind === "repository" && location.sourcePaths.some(catalog.sourceScope.isIgnored);
};

const matchesDeclarationPath = (input: {
  readonly declaration: CanonicalValuesEntry;
  readonly query: ImportRouteQuery;
  readonly resolvedPath: string;
}): boolean =>
  input.query.importedName === input.declaration.binding &&
  input.resolvedPath ===
    realPathOf(resolve(input.query.repositoryRoot, input.declaration.declarationPath));

const routeMatchesResolvedSource = (input: {
  readonly location: Extract<ResolvedModuleLocation, { readonly kind: "repository" }>;
  readonly query: ImportRouteQuery;
  readonly route: CanonicalValuesImportRoute;
}): boolean =>
  input.route.specifier === input.query.specifier &&
  input.route.exportName === input.query.importedName &&
  input.route.resolvedSourcePaths.some(
    (path) => realPathOf(resolve(input.query.repositoryRoot, path)) === input.location.path,
  );

const declarationExportsName = (path: string, importedName: string): boolean => {
  if (!/\.d\.[cm]?ts$/u.test(path)) return false;
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.ESNext, true);
  return sourceFile.statements.some((statement) => {
    if (!ts.isVariableStatement(statement)) return false;
    const modifiers = ts.getModifiers(statement);
    if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !== true) {
      return false;
    }
    return statement.declarationList.declarations.some(
      (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === importedName,
    );
  });
};

const matchingRuntimeRoute = (input: {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly location: Extract<ResolvedModuleLocation, { readonly kind: "repository" }>;
  readonly query: ImportRouteQuery;
}): readonly CanonicalValuesEntry[] => {
  if (!declarationExportsName(input.location.path, input.query.importedName)) return [];
  return input.entries.filter((declaration) =>
    declaration.importRoutes.some(
      (route) =>
        route.specifier === input.query.specifier && route.exportName === input.query.importedName,
    ),
  );
};

export const resolvedPublicImportEntries = (
  query: ImportRouteQuery,
  declarations: readonly CanonicalValuesEntry[],
): readonly CanonicalValuesEntry[] => {
  const location = resolvedModuleLocation(query);
  if (location.kind !== "repository") return [];
  const exact = declarations.filter((declaration) =>
    declaration.importRoutes.some((route) =>
      routeMatchesResolvedSource({ location, query, route }),
    ),
  );
  return exact.length === 0
    ? matchingRuntimeRoute({ entries: declarations, location, query })
    : exact;
};

export const resolvedDirectImportEntries = (
  query: ImportRouteQuery,
  declarations: readonly CanonicalValuesEntry[],
): readonly CanonicalValuesEntry[] => {
  const location = resolvedModuleLocation(query);
  if (location.kind !== "repository") return [];
  return declarations.filter((declaration) =>
    matchesDeclarationPath({ declaration, query, resolvedPath: location.path }),
  );
};
