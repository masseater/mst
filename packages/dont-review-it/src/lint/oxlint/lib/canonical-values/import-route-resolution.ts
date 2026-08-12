import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { attempt } from "es-toolkit";
import * as ts from "typescript-6";

import { pathIsInside } from "../path-is-inside.ts";
import { isRelativeImportSpecifier } from "./import-specifier.ts";
import { nearestPackageDirectory } from "./source-files.ts";
import { resolveViteConditions } from "./vite-alias-resolution.ts";
import { resolveViteRepositorySpecifier } from "./vite-repository-resolution.ts";

import type { CanonicalValuesEntry, CanonicalValuesImportRoute } from "./catalog.ts";

export type ImportRouteQuery = {
  readonly importedName: string;
  readonly specifier: string;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly resolutionMode?: ts.ResolutionMode;
};

export const IMPORT_MODULE_RESOLUTION_MODE: NonNullable<ts.ResolutionMode> = ts.ModuleKind.ESNext;
export const REQUIRE_MODULE_RESOLUTION_MODE: NonNullable<ts.ResolutionMode> =
  ts.ModuleKind.CommonJS;

const realPathOf = (path: string): string => {
  const absolutePath = resolve(path);
  const [failure, realPath] = attempt(() => realpathSync.native(absolutePath));
  return failure === null && realPath !== null ? realPath : absolutePath;
};

const matchesDeclarationPath = ({
  entry,
  importedName,
  repositoryRoot,
  resolvedPath,
}: {
  readonly entry: CanonicalValuesEntry;
  readonly importedName: string;
  readonly repositoryRoot: string;
  readonly resolvedPath: string;
}): boolean => {
  if (importedName !== entry.binding) return false;
  const declaration = realPathOf(resolve(repositoryRoot, entry.declarationPath));
  return resolvedPath === declaration;
};

const parsedCompilerOptions = (configPath: string): ts.CompilerOptions | null => {
  const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  if (read.error !== undefined) return null;
  return ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath)).options;
};

const containingFileOf = (query: ImportRouteQuery): string =>
  isAbsolute(query.filename) ? query.filename : resolve(query.repositoryRoot, query.filename);

const configPathAtOrAbove = (input: {
  readonly configName: "jsconfig.json" | "tsconfig.json";
  readonly directory: string;
  readonly repositoryRoot: string;
}): string | undefined => {
  if (!pathIsInside(input.repositoryRoot, input.directory)) return undefined;
  const candidate = resolve(input.directory, input.configName);
  if (ts.sys.fileExists(candidate)) return candidate;
  if (input.directory === input.repositoryRoot) return undefined;
  const parent = dirname(input.directory);
  return parent === input.directory
    ? undefined
    : configPathAtOrAbove({ ...input, directory: parent });
};

const compilerConfigPath = (
  query: ImportRouteQuery,
  containingFile: string,
): string | undefined => {
  const repositoryRoot = realPathOf(query.repositoryRoot);
  const searchDirectory = realPathOf(dirname(containingFile));
  return (
    configPathAtOrAbove({
      configName: "tsconfig.json",
      directory: searchDirectory,
      repositoryRoot,
    }) ??
    configPathAtOrAbove({
      configName: "jsconfig.json",
      directory: searchDirectory,
      repositoryRoot,
    })
  );
};

const compilerResolution = (
  query: ImportRouteQuery,
): { readonly containingFile: string; readonly options: ts.CompilerOptions } | null => {
  const containingFile = containingFileOf(query);
  const configPath = compilerConfigPath(query, containingFile);
  const options =
    configPath === undefined
      ? { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext }
      : parsedCompilerOptions(configPath);
  if (options === null) return null;
  const customConditions = [
    ...(options.customConditions ?? []),
    ...resolveViteConditions(query.repositoryRoot),
  ];
  return {
    containingFile,
    options: { ...options, customConditions: [...new Set(customConditions)] },
  };
};

export const configuredJsxRuntime = (input: {
  readonly filename: string;
  readonly repositoryRoot: string;
}): { readonly importSource: string | null; readonly runtime: string | null } => {
  const resolution = compilerResolution({
    ...input,
    importedName: "<namespace>",
    specifier: "",
  });
  if (resolution === null) return { importSource: null, runtime: null };
  const { jsx, jsxImportSource } = resolution.options;
  const runtime =
    jsx === ts.JsxEmit.ReactJSX
      ? "jsx-runtime"
      : jsx === ts.JsxEmit.ReactJSXDev
        ? "jsx-dev-runtime"
        : null;
  return {
    importSource: typeof jsxImportSource === "string" ? jsxImportSource : null,
    runtime,
  };
};

type ResolvedModuleLocation =
  | { readonly kind: "external" }
  | {
      readonly declarationFile: boolean;
      readonly kind: "repository";
      readonly packageResolution: boolean;
      readonly path: string;
    }
  | { readonly kind: "unresolved" };

const fileUrlModuleLocation = (query: ImportRouteQuery): ResolvedModuleLocation | null => {
  if (!query.specifier.startsWith("file:")) return null;
  const [urlFailure, filePath] = attempt(() => fileURLToPath(query.specifier));
  if (urlFailure !== null || filePath === null) return { kind: "unresolved" };
  const [pathFailure, resolvedPath] = attempt(() => realpathSync.native(filePath));
  if (pathFailure !== null || resolvedPath === null) return { kind: "unresolved" };
  const repositoryRoot = realPathOf(query.repositoryRoot);
  if (!pathIsInside(repositoryRoot, resolvedPath)) return { kind: "external" };
  const segments = relative(repositoryRoot, resolvedPath).split(sep);
  return segments.includes("node_modules")
    ? { kind: "external" }
    : {
        declarationFile: /\.d\.[cm]?ts$/u.test(resolvedPath),
        kind: "repository",
        packageResolution: false,
        path: resolvedPath,
      };
};

const typescriptModuleLocation = (query: ImportRouteQuery): ResolvedModuleLocation => {
  const resolution = compilerResolution(query);
  if (resolution === null) return { kind: "unresolved" };
  const resolvedModule = ts.resolveModuleName(
    query.specifier,
    resolution.containingFile,
    resolution.options,
    ts.sys,
    undefined,
    undefined,
    query.resolutionMode ?? IMPORT_MODULE_RESOLUTION_MODE,
  ).resolvedModule;
  if (resolvedModule === undefined) return { kind: "unresolved" };
  const repositoryRoot = realPathOf(query.repositoryRoot);
  const resolvedPath = realPathOf(resolvedModule.resolvedFileName);
  if (!pathIsInside(repositoryRoot, resolvedPath)) return { kind: "external" };
  const segments = relative(repositoryRoot, resolvedPath).split(sep);
  return segments.includes("node_modules")
    ? { kind: "external" }
    : {
        declarationFile: /\.d\.[cm]?ts$/u.test(resolvedPath),
        kind: "repository",
        packageResolution: resolvedModule.isExternalLibraryImport === true,
        path: resolvedPath,
      };
};

const resolvedModuleLocation = (query: ImportRouteQuery): ResolvedModuleLocation => {
  const fileUrl = fileUrlModuleLocation(query);
  return fileUrl ?? typescriptModuleLocation(query);
};

const viteSpecifierBase = (specifier: string): string => {
  if (specifier.startsWith("data:") || specifier.startsWith("file:")) return specifier;
  const suffix = specifier.search(/[?#]/u);
  return suffix === -1 ? specifier : specifier.slice(0, suffix);
};

const repositoryFileLocation = (
  query: ImportRouteQuery,
): Extract<ResolvedModuleLocation, { readonly kind: "repository" }> | null => {
  const containingFile = containingFileOf(query);
  const candidate = resolveViteRepositorySpecifier({ ...query, containingFile });
  if (candidate === null) return null;
  const resolvedPath = realPathOf(candidate);
  const repositoryRoot = realPathOf(query.repositoryRoot);
  if (!pathIsInside(repositoryRoot, resolvedPath)) return null;
  const segments = relative(repositoryRoot, resolvedPath).split(sep);
  return segments.includes("node_modules")
    ? null
    : {
        declarationFile: /\.d\.[cm]?ts$/u.test(resolvedPath),
        kind: "repository",
        packageResolution: false,
        path: resolvedPath,
      };
};

const repositorySourceLocation = (query: ImportRouteQuery): ResolvedModuleLocation => {
  const sourceQuery = { ...query, specifier: viteSpecifierBase(query.specifier) };
  const vite = repositoryFileLocation(sourceQuery);
  if (vite !== null) return vite;
  return resolvedModuleLocation(sourceQuery);
};

const matchesPathPattern = (specifier: string, pattern: string): boolean => {
  const wildcard = pattern.indexOf("*");
  if (wildcard === -1) return specifier === pattern;
  if (pattern.includes("*", wildcard + 1)) return false;
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  return (
    specifier.length >= prefix.length + suffix.length &&
    specifier.startsWith(prefix) &&
    specifier.endsWith(suffix)
  );
};

export const matchesConfiguredPathAlias = (query: ImportRouteQuery): boolean => {
  const resolution = compilerResolution(query);
  if (resolution === null) return false;
  return Object.keys(resolution.options.paths ?? {}).some((pattern) =>
    matchesPathPattern(query.specifier, pattern),
  );
};

export const repositoryModulePath = (query: ImportRouteQuery): string | null => {
  const location = repositorySourceLocation(query);
  return location.kind === "repository" ? location.path : null;
};

export const repositoryModuleResolutionKind = (
  query: ImportRouteQuery,
): ResolvedModuleLocation["kind"] => repositorySourceLocation(query).kind;

const directImportPaths = (query: ImportRouteQuery): readonly string[] => {
  const directSpecifier = isRelativeImportSpecifier(query.specifier) || isAbsolute(query.specifier);
  if (!directSpecifier) {
    const repositoryPath = repositoryModulePath(query);
    return repositoryPath === null ? [] : [repositoryPath];
  }
  if (isAbsolute(query.specifier) && !pathIsInside(query.repositoryRoot, query.specifier))
    return [];
  const location = repositorySourceLocation(query);
  if (location.kind === "repository") return [location.path];
  return [];
};

const routeSharesPackageWithDeclaration = ({
  location,
  query,
  route,
}: {
  readonly location: Extract<ResolvedModuleLocation, { readonly kind: "repository" }>;
  readonly query: ImportRouteQuery;
  readonly route: CanonicalValuesImportRoute;
}): boolean => {
  if (
    !location.declarationFile ||
    !location.packageResolution ||
    matchesConfiguredPathAlias(query)
  ) {
    return false;
  }
  const repositoryRoot = realPathOf(query.repositoryRoot);
  const resolvedPackage = nearestPackageDirectory(dirname(location.path), repositoryRoot);
  if (resolvedPackage === null) return false;
  return route.resolvedSourcePaths.some((path) => {
    const sourcePath = realPathOf(resolve(query.repositoryRoot, path));
    return nearestPackageDirectory(dirname(sourcePath), repositoryRoot) === resolvedPackage;
  });
};

const routeMatchesResolvedSource = ({
  location,
  query,
  route,
}: {
  readonly location: Extract<ResolvedModuleLocation, { readonly kind: "repository" }>;
  readonly query: ImportRouteQuery;
  readonly route: CanonicalValuesImportRoute;
}): boolean =>
  route.specifier === query.specifier &&
  route.exportName === query.importedName &&
  (route.resolvedSourcePaths.some(
    (path) => realPathOf(resolve(query.repositoryRoot, path)) === location.path,
  ) ||
    routeSharesPackageWithDeclaration({ location, query, route }));

export const resolvedPublicImportEntries = (
  query: ImportRouteQuery,
  entries: readonly CanonicalValuesEntry[],
): readonly CanonicalValuesEntry[] => {
  const location = resolvedModuleLocation(query);
  if (location.kind !== "repository") return [];
  return entries.filter((entry) =>
    entry.importRoutes.some((route) => routeMatchesResolvedSource({ location, query, route })),
  );
};

export const resolvedDirectImportEntries = (
  query: ImportRouteQuery,
  entries: readonly CanonicalValuesEntry[],
): readonly CanonicalValuesEntry[] => {
  const resolvedPaths = directImportPaths(query);
  return entries.filter((entry) =>
    resolvedPaths.some((resolvedPath) =>
      matchesDeclarationPath({
        entry,
        importedName: query.importedName,
        repositoryRoot: query.repositoryRoot,
        resolvedPath,
      }),
    ),
  );
};
