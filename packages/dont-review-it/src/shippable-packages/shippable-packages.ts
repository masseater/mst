import { isPlainObject, uniq } from "es-toolkit";

import { lineOfProperty, propertyValueOf, stringEntriesOf } from "../intent-skills/manifest.ts";
import {
  publishedEntriesOf,
  strippedTypeSource,
  type PublishedEntry,
} from "./published-entries.ts";
import { readShippableWorkspaces, type ShippableWorkspace } from "./workspace-manifests.ts";

import type { ScannedProblems } from "@mst/repository-checks";
import type { RepositoryProblem } from "../problem.ts";
import type { ShippablePackagesConfig } from "./config.ts";

type ShippablePackage = {
  readonly workspace: ShippableWorkspace;
  readonly withheldNames: readonly string[];
  readonly config: ShippablePackagesConfig;
};

const packedSegmentOf = (specifier: string): string =>
  specifier.replace(/^\.\//u, "").replace(/\/.*$/u, "");

const withheldDependencies = ({
  workspace,
  withheldNames,
  config,
}: ShippablePackage): readonly RepositoryProblem[] =>
  config.dependencyKeys.flatMap((dependencyField) => {
    const declared = propertyValueOf(workspace.manifest.root, dependencyField);
    if (!isPlainObject(declared)) return [];

    return Object.keys(declared)
      .filter((dependencyName) => withheldNames.includes(dependencyName))
      .map((dependencyName) => ({
        file: workspace.manifest.file.relativePath,
        line: lineOfProperty({ manifest: workspace.manifest, key: dependencyField }),
        message: `A package that npm can publish must not declare ${dependencyField} on ${dependencyName}, because that workspace is marked "private": true and no registry ever serves it. Move it to devDependencies so the build bundles it, or let it publish by removing "private": true.`,
      }));
  });

const declaringLineOf = (
  { workspace, config }: ShippablePackage,
  published: PublishedEntry,
): number =>
  lineOfProperty({
    manifest: workspace.manifest,
    key:
      propertyValueOf(workspace.manifest.root, config.publishConfigKey) === undefined
        ? published.key.replace(/[.[].*$/u, "")
        : config.publishConfigKey,
  });

const typeStrippedEntries = (
  scope: ShippablePackage,
  publishedEntries: readonly PublishedEntry[],
): readonly RepositoryProblem[] =>
  publishedEntries
    .filter(
      (published) =>
        published.runtime &&
        strippedTypeSource({ specifier: published.specifier, config: scope.config }),
    )
    .map((published) => ({
      file: scope.workspace.manifest.file.relativePath,
      line: declaringLineOf(scope, published),
      message: `The published ${published.key} entry must not point at ${published.specifier}, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through ${scope.config.publishConfigKey} when the local path has to stay on the source.`,
    }));

const unpackedEntries = (
  scope: ShippablePackage,
  publishedEntries: readonly PublishedEntry[],
): readonly RepositoryProblem[] => {
  const { workspace, config } = scope;
  const allowed = stringEntriesOf(propertyValueOf(workspace.manifest.root, config.filesKey));
  if (allowed === null) return [];

  const packed = allowed.map(packedSegmentOf);
  const dropped = uniq(
    publishedEntries
      .filter((published) => published.specifier !== config.alwaysPackedEntry)
      .map((published) => packedSegmentOf(published.specifier))
      .filter((segment) => segment !== "" && !packed.includes(segment)),
  );

  return dropped.map((segment) => ({
    file: workspace.manifest.file.relativePath,
    line: lineOfProperty({ manifest: workspace.manifest, key: config.filesKey }),
    message: `The files allowlist must not leave out ${segment}, because npm packs only what files names and a published entry would resolve to a path the archive never carried. Add "${segment}" to files.`,
  }));
};

const packageProblems = (scope: ShippablePackage): readonly RepositoryProblem[] => {
  const publishedEntries = publishedEntriesOf({
    manifestValueOf: (manifestField) =>
      propertyValueOf(scope.workspace.manifest.root, manifestField),
    config: scope.config,
  });

  return [
    ...withheldDependencies(scope),
    ...typeStrippedEntries(scope, publishedEntries),
    ...unpackedEntries(scope, publishedEntries),
  ];
};

export const shippablePackagesProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: ShippablePackagesConfig;
}): ScannedProblems => {
  const workspaces = readShippableWorkspaces(repositoryRoot);
  const withheldNames = workspaces
    .filter((workspace) => workspace.withheld)
    .map((workspace) => workspace.packageName);
  const shippable = workspaces.filter((workspace) => !workspace.withheld);

  return {
    problems: shippable.flatMap((workspace) =>
      packageProblems({ workspace, withheldNames, config }),
    ),
    scanned: shippable.length,
  };
};
