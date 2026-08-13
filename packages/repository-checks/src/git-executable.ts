import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

import { attempt } from "es-toolkit";

const GIT_FILE_NAMES: readonly string[] = ["git.exe", "git"];

const gitFileIn = (directory: string): string | null =>
  GIT_FILE_NAMES.map((fileName) => join(directory, fileName)).find((candidate) => {
    const [unreachableFile] = attempt(() => {
      accessSync(candidate, constants.X_OK);
    });
    return unreachableFile === null;
  }) ?? null;

const gitPathBySearchPath = new Map<string, string>();

export const gitExecutablePath = (searchPath: string | undefined): string => {
  const searchedPath = searchPath ?? "";
  const knownGitPath = gitPathBySearchPath.get(searchedPath);
  if (knownGitPath !== undefined) return knownGitPath;

  const discoveredGitPath =
    searchedPath
      .split(delimiter)
      .filter((directory) => directory !== "")
      .reduce<string | null>((discovered, directory) => discovered ?? gitFileIn(directory), null) ??
    "git";
  gitPathBySearchPath.set(searchedPath, discoveredGitPath);
  return discoveredGitPath;
};
