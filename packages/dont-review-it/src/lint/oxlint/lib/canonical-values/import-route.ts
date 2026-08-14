import { isBuiltin } from "node:module";
import { isAbsolute } from "node:path";

import { pathIsInside } from "../path-is-inside.ts";
import {
  isIgnoredRepositoryModule,
  matchesConfiguredPathAlias,
  repositoryModulePath,
  resolvedDirectImportEntries,
  resolvedPublicImportEntries,
  type ImportRouteQuery,
} from "./import-route-resolution.ts";
import { isRelativeImportSpecifier } from "./import-specifier.ts";

import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const registeredEntriesForImportRoute = (
  query: ImportRouteQuery,
  catalog: CanonicalValuesCatalog,
): readonly CanonicalValuesEntry[] => {
  const publicEntries = catalog.entries.filter((declaration) =>
    declaration.importRoutes.some(
      (route) => route.specifier === query.specifier && route.exportName === query.importedName,
    ),
  );
  return publicEntries.length === 0
    ? resolvedDirectImportEntries(query, catalog.entries)
    : resolvedPublicImportEntries(query, publicEntries);
};

const SUBPATH_IMPORT_PREFIX = "#";

const packageNameOf = (specifier: string): string => {
  if (!specifier.startsWith("@")) return specifier.split("/")[0] as string;
  return specifier.split("/").slice(0, 2).join("/");
};

const belongsToRegisteredPackage = (specifier: string, catalog: CanonicalValuesCatalog): boolean =>
  catalog.packageNames.has(packageNameOf(specifier));

const isKnownRepositorySpecifier = (
  query: ImportRouteQuery,
  catalog: CanonicalValuesCatalog,
): boolean =>
  repositoryModulePath(query) !== null ||
  query.specifier.startsWith(SUBPATH_IMPORT_PREFIX) ||
  belongsToRegisteredPackage(query.specifier, catalog);

const isExternalProtocolSpecifier = (specifier: string): boolean =>
  isBuiltin(specifier) || /^[a-z][a-z+.-]*:/iu.test(specifier);

export const importRouteStatus = (
  query: ImportRouteQuery,
  catalog: CanonicalValuesCatalog,
): "registered" | "unregistered" | "external" => {
  if (isIgnoredRepositoryModule(query, catalog)) return "external";
  if (registeredEntriesForImportRoute(query, catalog).length !== 0) return "registered";
  if (isRelativeImportSpecifier(query.specifier)) return "unregistered";
  if (isAbsolute(query.specifier)) {
    return pathIsInside(query.repositoryRoot, query.specifier) ? "unregistered" : "external";
  }
  if (isKnownRepositorySpecifier(query, catalog)) return "unregistered";
  if (isExternalProtocolSpecifier(query.specifier)) return "external";
  if (matchesConfiguredPathAlias(query)) return "unregistered";
  return "external";
};
