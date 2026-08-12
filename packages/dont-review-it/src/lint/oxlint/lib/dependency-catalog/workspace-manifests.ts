import { dirname, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { listRepositoryFiles } from "../canonical-values/source-files.ts";
import { declaredDependenciesIn } from "./declared-dependencies.ts";
import { workspaceDirectoryOf, type WorkspaceDependencies } from "./shared-dependency-index.ts";

const scannedWorkspaces = (repositoryRoot: string): readonly WorkspaceDependencies[] =>
  listRepositoryFiles(repositoryRoot).manifests.map((manifest) => ({
    relativeDir: workspaceDirectoryOf({
      repositoryRoot,
      packageDirectory: dirname(manifest.absolutePath),
    }),
    dependencies: declaredDependenciesIn(readJsonFile(manifest.absolutePath)),
  }));

const scannedWorkspacesUnder = memoize(scannedWorkspaces);

export const loadWorkspaceDependencies = (options: {
  readonly repositoryRoot: string;
}): readonly WorkspaceDependencies[] => scannedWorkspacesUnder(resolve(options.repositoryRoot));
