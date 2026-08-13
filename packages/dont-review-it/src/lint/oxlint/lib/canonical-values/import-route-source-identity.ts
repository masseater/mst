import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { attempt } from "es-toolkit";

import { pathIsInside } from "../path-is-inside.ts";

export type RepositoryModuleLocation =
  | { readonly kind: "external" }
  | {
      readonly kind: "repository";
      readonly path: string;
      readonly sourcePaths: readonly string[];
    };

export const realPathOf = (path: string): string => {
  const absolutePath = resolve(path);
  const [failure, realPath] = attempt(() => realpathSync.native(absolutePath));
  return failure === null && realPath !== null ? realPath : absolutePath;
};

const lexicalRepositorySource = (repositoryRoot: string, resolvedPath: string): string | null => {
  const sourcePath = resolve(resolvedPath);
  if (!pathIsInside(repositoryRoot, sourcePath)) return null;
  return relative(repositoryRoot, sourcePath).split(sep).includes("node_modules")
    ? null
    : sourcePath;
};

export const repositoryModuleLocation = ({
  repositoryRoot: rawRepositoryRoot,
  resolvedPath,
}: {
  readonly repositoryRoot: string;
  readonly resolvedPath: string;
}): RepositoryModuleLocation => {
  const repositoryRoot = realPathOf(rawRepositoryRoot);
  const path = realPathOf(resolvedPath);
  if (!pathIsInside(repositoryRoot, path)) return { kind: "external" };
  if (relative(repositoryRoot, path).split(sep).includes("node_modules")) {
    return { kind: "external" };
  }
  const lexicalPath = lexicalRepositorySource(resolve(rawRepositoryRoot), resolvedPath);
  const sourcePaths = lexicalPath === null || lexicalPath === path ? [path] : [path, lexicalPath];
  return { kind: "repository", path, sourcePaths };
};
