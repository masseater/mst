import { glob } from "node:fs/promises";
import { join } from "node:path";

import { attemptAsync, isPlainObject } from "es-toolkit";
import { parse } from "yaml";

import { fileTextOrNull } from "../file-text.ts";

import type { Dirent } from "node:fs";
import type { RepositoryProblem } from "@mst/repository-checks";

export type Workspace = {
  readonly directory: string;
  readonly packageName: string;
};

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

const UNREADABLE_MANIFEST =
  "A workspace definition must not be unreadable while it exists, because a scan that silently covers fewer workspaces reports the same green as a scan that covers them all.";

const NAMELESS_PACKAGE =
  "A workspace must not go without a name in its package.json, because the generated specification list is titled with it. Name the package.";

const packageNameOf = (manifestSource: string): string | null => {
  const manifest: unknown = JSON.parse(manifestSource);
  if (!isPlainObject(manifest)) return null;
  const { name }: { readonly name?: unknown } = manifest;
  return typeof name === "string" && name.length > 0 ? name : null;
};

const workspaceGlobsOf = (manifestSource: string): readonly string[] => {
  const manifest: unknown = parse(manifestSource);
  if (!isPlainObject(manifest)) return [];
  const { packages }: { readonly packages?: unknown } = manifest;
  if (!Array.isArray(packages)) return [];
  return packages.filter((candidate): candidate is string => typeof candidate === "string");
};

const workspaceDirectoriesOf = async (input: {
  readonly repositoryRoot: string;
  readonly globs: readonly string[];
}): Promise<readonly string[]> => {
  const listedEntries: readonly Dirent[] = await Array.fromAsync(
    glob([...input.globs], { cwd: input.repositoryRoot, withFileTypes: true }),
  );
  return listedEntries
    .filter((listed) => listed.isDirectory())
    .map((listed) => join(listed.parentPath, listed.name));
};

const workspaceOf = async (
  directory: string,
): Promise<{
  readonly workspace: Workspace | null;
  readonly problems: readonly RepositoryProblem[];
}> => {
  const manifestSource = await fileTextOrNull(join(directory, "package.json"));
  if (manifestSource === null) return { workspace: null, problems: [] };

  const packageName = packageNameOf(manifestSource);
  if (packageName === null) {
    return {
      workspace: null,
      problems: [{ file: join(directory, "package.json"), line: null, message: NAMELESS_PACKAGE }],
    };
  }
  return { workspace: { directory, packageName }, problems: [] };
};

const soleRootWorkspace = async (
  repositoryRoot: string,
): Promise<{
  readonly workspaces: readonly Workspace[];
  readonly problems: readonly RepositoryProblem[];
}> => {
  const read = await workspaceOf(repositoryRoot);
  return {
    workspaces: read.workspace === null ? [] : [read.workspace],
    problems: read.problems,
  };
};

export const listWorkspaces = async (input: {
  readonly repositoryRoot: string;
}): Promise<{
  readonly workspaces: readonly Workspace[];
  readonly problems: readonly RepositoryProblem[];
}> => {
  const { repositoryRoot } = input;
  const manifestPath = join(repositoryRoot, WORKSPACE_MANIFEST);
  const [failure, manifestSource] = await attemptAsync<string | null, Error>(async () =>
    fileTextOrNull(manifestPath),
  );
  if (failure !== null) {
    return {
      workspaces: [],
      problems: [{ file: manifestPath, line: null, message: UNREADABLE_MANIFEST }],
    };
  }
  if (manifestSource === null) return soleRootWorkspace(repositoryRoot);

  const directories = await workspaceDirectoriesOf({
    repositoryRoot,
    globs: workspaceGlobsOf(manifestSource),
  });
  const read = await Promise.all(directories.toSorted().map(workspaceOf));
  return {
    workspaces: read.flatMap((listed) => (listed.workspace === null ? [] : [listed.workspace])),
    problems: read.flatMap((listed) => listed.problems),
  };
};
