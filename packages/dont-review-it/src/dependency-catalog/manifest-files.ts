import { globSync } from "node:fs";
import { join } from "node:path";
import { normalize } from "node:path/posix";

import { uniq } from "es-toolkit";

import { readJsonFile } from "../lint/oxlint/lib/canonical-values/read-json-file.ts";
import { NEGATION_PREFIX } from "../lint/oxlint/lib/tracked-paths/ignore-listing.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type WorkspaceManifest = {
  readonly relativePath: string;
  readonly manifest: unknown;
};

const manifestPatternFor = ({
  directoryPattern,
  manifestFileName,
}: {
  readonly directoryPattern: string;
  readonly manifestFileName: string;
}): string => normalize(`${directoryPattern}/${manifestFileName}`);

export const readWorkspaceManifests = ({
  repositoryRoot,
  packagePatterns,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packagePatterns: readonly string[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly WorkspaceManifest[] => {
  const positivePatterns = packagePatterns
    .filter((pattern) => !pattern.startsWith(NEGATION_PREFIX))
    .map((directoryPattern) =>
      manifestPatternFor({ directoryPattern, manifestFileName: config.manifestFileName }),
    );
  const excludedPatterns = packagePatterns
    .filter((pattern) => pattern.startsWith(NEGATION_PREFIX))
    .map((pattern) => pattern.slice(NEGATION_PREFIX.length))
    .map((directoryPattern) =>
      manifestPatternFor({ directoryPattern, manifestFileName: config.manifestFileName }),
    );
  const workspaceManifestPaths = uniq(
    positivePatterns.length === 0
      ? []
      : globSync(positivePatterns, { cwd: repositoryRoot, exclude: excludedPatterns }),
  )
    .toSorted()
    .filter((relativePath) => relativePath !== config.manifestFileName);
  const manifestPaths = [config.manifestFileName, ...workspaceManifestPaths];

  return manifestPaths.flatMap((relativePath) => {
    const manifest = readJsonFile(join(repositoryRoot, relativePath));
    return manifest === null ? [] : [{ relativePath, manifest }];
  });
};
