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

const referencedByRunningCode = (workspaceRoot: string): ReadonlySet<string> =>
  new Set(
    listRepositoryFiles(workspaceRoot).declarationSources.flatMap((file) =>
      packagesReferencedFrom(file.absolutePath, workspaceRoot),
    ),
  );

const referencedByWorkspaceRoot = new Map<string, ReadonlySet<string>>();

export const isReachedOnlyFromSpecs = ({
  packageDirectory,
  workspaceRoot,
}: {
  readonly packageDirectory: string;
  readonly workspaceRoot: string;
}): boolean => {
  const remembered = referencedByWorkspaceRoot.get(workspaceRoot);
  const referenced = remembered ?? referencedByRunningCode(workspaceRoot);
  referencedByWorkspaceRoot.set(workspaceRoot, referenced);
  return !referenced.has(packageDirectory);
};
