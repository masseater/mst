import { isGitIgnoredSource } from "./git-ignored-source.ts";
import { isOutOfScopeSource } from "./out-of-scope-source.ts";

export const isOutOfScopeBoundarySource = (sourcePath: string, repositoryRoot: string): boolean =>
  isOutOfScopeSource(sourcePath, repositoryRoot) && !isGitIgnoredSource(sourcePath, repositoryRoot);
