import { readdirSync } from "node:fs";
import { join } from "node:path";
import { normalize } from "node:path/posix";

import { readUnlessMissing } from "@mst/utils";
import { uniq } from "es-toolkit";

import { readJsonFile } from "../lint/oxlint/lib/canonical-values/read-json-file.ts";
import { NEGATION_PREFIX } from "../lint/oxlint/lib/tracked-paths/ignore-listing.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type WorkspaceManifest = {
  readonly relativePath: string;
  readonly manifest: unknown;
};

const SINGLE_LEVEL_PATTERN_SUFFIX = "/*";

const directoriesMatching = ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): readonly string[] => {
  if (pattern.startsWith(NEGATION_PREFIX)) return [];
  if (!pattern.endsWith(SINGLE_LEVEL_PATTERN_SUFFIX)) return [pattern];

  const parentDirectory = pattern.slice(0, -SINGLE_LEVEL_PATTERN_SUFFIX.length);
  const parentEntries =
    readUnlessMissing(() =>
      readdirSync(join(repositoryRoot, parentDirectory), { withFileTypes: true }),
    ) ?? [];

  return parentEntries
    .filter((parentEntry) => parentEntry.isDirectory())
    .map((parentEntry) => `${parentDirectory}/${parentEntry.name}`);
};

export const readWorkspaceManifests = ({
  repositoryRoot,
  packagePatterns,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packagePatterns: readonly string[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly WorkspaceManifest[] => {
  const workspaceManifestPaths = uniq(
    packagePatterns
      .flatMap((pattern) => directoriesMatching({ repositoryRoot, pattern }))
      .map((directory) => normalize(`${directory}/${config.manifestFileName}`)),
  )
    .toSorted()
    .filter((relativePath) => relativePath !== config.manifestFileName);
  const manifestPaths = [config.manifestFileName, ...workspaceManifestPaths];

  return manifestPaths.flatMap((relativePath) => {
    const manifest = readJsonFile(join(repositoryRoot, relativePath));
    return manifest === null ? [] : [{ relativePath, manifest }];
  });
};
