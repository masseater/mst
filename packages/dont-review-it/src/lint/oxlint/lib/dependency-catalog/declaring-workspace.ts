import { dirname, resolve } from "node:path";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../canonical-values/workspace-root.ts";
import { workspaceDirectoryOf } from "./shared-dependency-index.ts";

export type DeclaringWorkspace = {
  readonly repositoryRoot: string;
  readonly relativeDir: string;
};

export const declaringWorkspaceOf = (carried: {
  readonly cwd: string;
  readonly filename: string;
}): DeclaringWorkspace | null => {
  const fileDirectory = dirname(resolve(carried.cwd, carried.filename));
  const repositoryRoot = findWorkspaceRoot(fileDirectory);
  const packageDirectory = nearestPackageDirectory(fileDirectory, repositoryRoot);
  if (packageDirectory === null) return null;

  return {
    repositoryRoot,
    relativeDir: workspaceDirectoryOf({ repositoryRoot, packageDirectory }),
  };
};
