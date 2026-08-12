import { relative } from "node:path";

import { groupBy, sortBy, uniqBy } from "es-toolkit";

import { toPosixPath } from "../posix-path.ts";

import type { DeclaredDependency } from "./declared-dependencies.ts";

export const REPOSITORY_ROOT_WORKSPACE = ".";

const SHARED_BY_AT_LEAST = 2;

export type WorkspaceDependencies = {
  readonly relativeDir: string;
  readonly dependencies: readonly DeclaredDependency[];
};

export type WorkspaceDependenciesLoader = (options: {
  readonly repositoryRoot: string;
}) => readonly WorkspaceDependencies[];

export type DependencySite = {
  readonly relativeDir: string;
  readonly declaredVersion: string;
};

export type UnregisteredSharedDependency = {
  readonly packageName: string;
  readonly sites: readonly DependencySite[];
};

export type SharedDependencyIndex = ReadonlyMap<string, readonly UnregisteredSharedDependency[]>;

export const workspaceDirectoryOf = (location: {
  readonly repositoryRoot: string;
  readonly packageDirectory: string;
}): string => {
  const within = toPosixPath(relative(location.repositoryRoot, location.packageDirectory));
  return within === "" ? REPOSITORY_ROOT_WORKSPACE : within;
};

export const describeSites = (sites: readonly DependencySite[]): string =>
  sites.map((site) => `\`${site.relativeDir}\` at \`${site.declaredVersion}\``).join(", ");

type PlacedDependency = DependencySite & { readonly packageName: string };

const placedDependenciesIn = (
  workspaces: readonly WorkspaceDependencies[],
): readonly PlacedDependency[] =>
  workspaces.flatMap((workspace) =>
    uniqBy(workspace.dependencies, (dependency) => dependency.packageName).map((dependency) => ({
      packageName: dependency.packageName,
      relativeDir: workspace.relativeDir,
      declaredVersion: dependency.declaredVersion,
    })),
  );

const siteOf = ({ relativeDir, declaredVersion }: PlacedDependency): DependencySite => ({
  relativeDir,
  declaredVersion,
});

const unregisteredSharedIn = (tally: {
  readonly placed: readonly PlacedDependency[];
  readonly catalog: ReadonlySet<string>;
}): readonly UnregisteredSharedDependency[] =>
  Object.entries(groupBy(tally.placed, (dependency) => dependency.packageName))
    .filter(
      ([packageName, placed]) =>
        placed.length >= SHARED_BY_AT_LEAST && !tally.catalog.has(packageName),
    )
    .map(([packageName, placed]) => ({
      packageName,
      sites: sortBy(placed.map(siteOf), ["relativeDir"]),
    }));

export const sharedDependencyIndex = (repository: {
  readonly workspaces: readonly WorkspaceDependencies[];
  readonly catalog: ReadonlySet<string>;
  readonly deviations: ReadonlyMap<string, ReadonlySet<string>>;
}): SharedDependencyIndex => {
  const claims = unregisteredSharedIn({
    placed: placedDependenciesIn(repository.workspaces),
    catalog: repository.catalog,
  })
    .flatMap((entry) => entry.sites.map((site) => ({ relativeDir: site.relativeDir, entry })))
    .filter(
      (claim) =>
        repository.deviations.get(claim.relativeDir)?.has(claim.entry.packageName) !== true,
    );

  return new Map(
    Object.entries(groupBy(claims, (claim) => claim.relativeDir)).map(([relativeDir, grouped]) => [
      relativeDir,
      sortBy(
        grouped.map((claim) => claim.entry),
        ["packageName"],
      ),
    ]),
  );
};
