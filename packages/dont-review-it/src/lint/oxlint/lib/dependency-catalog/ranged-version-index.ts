import { groupBy, sortBy, uniqBy } from "es-toolkit";

import { declaredRangeOf, type DeclaredDependency } from "./declared-dependencies.ts";

import type { CatalogEntryVersion } from "./catalog-entries.ts";
import type { WorkspaceDependencies } from "./shared-dependency-index.ts";

export type RangedDeclarationIndex = ReadonlyMap<string, readonly DeclaredDependency[]>;

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/u;

const VERSION_LEADING = /^[\d^~<>=*xX]/u;

const isVersionRange = (declaredVersion: string): boolean => {
  const range = declaredRangeOf(declaredVersion);
  return VERSION_LEADING.test(range) && !EXACT_VERSION.test(range);
};

export const rangedManifestDeclarations = ({
  workspaces,
  intentionalRanges,
}: {
  readonly workspaces: readonly WorkspaceDependencies[];
  readonly intentionalRanges: ReadonlySet<string>;
}): RangedDeclarationIndex => {
  const placed = workspaces.flatMap((workspace) =>
    uniqBy(workspace.dependencies, (dependency) => dependency.packageName)
      .filter(
        (dependency) =>
          isVersionRange(dependency.declaredVersion) &&
          !intentionalRanges.has(dependency.packageName),
      )
      .map((dependency) => ({
        relativeDir: workspace.relativeDir,
        packageName: dependency.packageName,
        declaredVersion: dependency.declaredVersion,
      })),
  );

  return new Map(
    Object.entries(groupBy(placed, (declaration) => declaration.relativeDir)).map(
      ([relativeDir, grouped]) => [
        relativeDir,
        sortBy(
          grouped.map(({ packageName, declaredVersion }) => ({ packageName, declaredVersion })),
          ["packageName"],
        ),
      ],
    ),
  );
};

export const rangedCatalogEntries = ({
  catalogEntries,
  intentionalRanges,
}: {
  readonly catalogEntries: readonly CatalogEntryVersion[];
  readonly intentionalRanges: ReadonlySet<string>;
}): readonly DeclaredDependency[] =>
  sortBy(
    catalogEntries
      .filter(
        (listed) =>
          isVersionRange(listed.declaredVersion) && !intentionalRanges.has(listed.dependencyName),
      )
      .map((listed) => ({
        packageName: listed.dependencyName,
        declaredVersion: listed.declaredVersion,
      })),
    ["packageName"],
  );
