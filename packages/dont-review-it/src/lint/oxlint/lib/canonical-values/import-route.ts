import { dirname, relative, resolve } from "node:path";

import { toPosixPath } from "../posix-path.ts";

import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const MODULE_FILE_SUFFIX = /\.[cm]?[jt]sx?$/u;

const INDEX_MODULE_SUFFIX = /\/index$/u;

const SUBPATH_IMPORT_PREFIX = "#";

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

const matchesExportPath = (specifier: string, entry: CanonicalValuesEntry): boolean =>
  entry.exportPath !== null &&
  (specifier === entry.exportPath || specifier.startsWith(`${entry.exportPath}/`));

const withoutModuleSuffix = (path: string): string =>
  toPosixPath(path).replace(MODULE_FILE_SUFFIX, "").replace(INDEX_MODULE_SUFFIX, "");

const matchesDeclarationPath = (
  {
    resolvedPath,
    repositoryRoot,
  }: { readonly resolvedPath: string; readonly repositoryRoot: string },
  entry: CanonicalValuesEntry,
): boolean => {
  const declaration = withoutModuleSuffix(entry.declarationPath);
  return (
    withoutModuleSuffix(relative(repositoryRoot, resolvedPath)) === declaration ||
    withoutModuleSuffix(resolvedPath).endsWith(`/${declaration}`)
  );
};

export const importRouteStatus = (
  {
    specifier,
    filename,
    repositoryRoot,
  }: { readonly specifier: string; readonly filename: string; readonly repositoryRoot: string },
  catalog: CanonicalValuesCatalog,
): "registered" | "unregistered" | "external" => {
  if (catalog.entries.some((entry) => matchesExportPath(specifier, entry))) return "registered";
  if (isRelativeSpecifier(specifier)) {
    const resolvedPath = resolve(dirname(filename), specifier);
    return catalog.entries.some((entry) =>
      matchesDeclarationPath({ resolvedPath, repositoryRoot }, entry),
    )
      ? "registered"
      : "unregistered";
  }
  if (specifier.startsWith(SUBPATH_IMPORT_PREFIX)) return "unregistered";
  return "external";
};
