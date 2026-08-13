import { dirname } from "node:path/posix";

import { uniq } from "es-toolkit";

import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";

const REPOSITORY_ROOT = ".";

export const packageRootsIn = (repositoryRoot: string): readonly string[] =>
  uniq([
    REPOSITORY_ROOT,
    ...listRepositoryFiles(repositoryRoot).manifests.map((manifest) =>
      dirname(manifest.relativePath),
    ),
  ]).toSorted();
