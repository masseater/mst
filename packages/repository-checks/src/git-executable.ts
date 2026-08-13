import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

import { attempt, memoize } from "es-toolkit";

const GIT_FILE_NAMES: readonly string[] = ["git.exe", "git"];

const gitFileIn = (directory: string): string | null =>
  GIT_FILE_NAMES.map((fileName) => join(directory, fileName)).find((candidate) => {
    const [unreachableFile] = attempt(() => {
      accessSync(candidate, constants.X_OK);
    });
    return unreachableFile === null;
  }) ?? null;

export const gitExecutablePath: (searchPath: string | undefined) => string = memoize(
  (searchPath: string | undefined): string =>
    (searchPath ?? "")
      .split(delimiter)
      .filter((directory) => directory !== "")
      .reduce<string | null>((discovered, directory) => discovered ?? gitFileIn(directory), null) ??
    "git",
  { getCacheKey: (searchPath: string | undefined) => searchPath ?? "" },
);
