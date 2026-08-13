import { memoize } from "es-toolkit";

import { listRepositoryFiles } from "../canonical-values/source-files.ts";
import { couplingEdgesOf } from "./entry-reachability.ts";
import { isInsideDirectory } from "./package-entries.ts";
import { packageDirectoryInWorkspace } from "./specifier-resolution.ts";

const packagesReferencedFrom = (fromFile: string, workspaceRoot: string): readonly string[] =>
  couplingEdgesOf(fromFile)
    .map((edge) =>
      packageDirectoryInWorkspace({ specifier: edge.specifier, fromFile, workspaceRoot }),
    )
    .flatMap((found) =>
      found === null || isInsideDirectory({ path: fromFile, directory: found.directory })
        ? []
        : [found.directory],
    );

const referencedByRunningCode = memoize(
  (workspaceRoot: string): ReadonlySet<string> =>
    new Set(
      listRepositoryFiles(workspaceRoot).declarationSources.flatMap((file) =>
        packagesReferencedFrom(file.absolutePath, workspaceRoot),
      ),
    ),
);

export const isReachedOnlyFromSpecs = ({
  packageDirectory,
  workspaceRoot,
}: {
  readonly packageDirectory: string;
  readonly workspaceRoot: string;
}): boolean => !referencedByRunningCode(workspaceRoot).has(packageDirectory);
