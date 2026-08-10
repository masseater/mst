import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";

import { readTextFile } from "../../lint/oxlint/lib/canonical-values/source-files.ts";
import { ignoreFilePatterns } from "./ignore-file-patterns.ts";

export type GitEnvironment = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

const gitOutput = (args: readonly string[], environment: GitEnvironment): string | null => {
  const output = attempt(() =>
    execFileSync("git", [...args], {
      cwd: environment.cwd,
      encoding: "utf8",
      env: environment.env,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  )[1];

  return output === null ? null : output.trim();
};

const configHomeOf = (environment: GitEnvironment): string => {
  const configHome = environment.env.XDG_CONFIG_HOME;
  if (configHome !== undefined && configHome !== "") return configHome;

  const home = environment.env.HOME;
  return join(home === undefined || home === "" ? homedir() : home, ".config");
};

const globalExcludeFile = (environment: GitEnvironment): string => {
  const configured = gitOutput(
    ["config", "--type=path", "--get", "core.excludesFile"],
    environment,
  );
  if (configured !== null && configured !== "") return configured;

  return join(configHomeOf(environment), "git", "ignore");
};

const repositoryExcludeFiles = (environment: GitEnvironment): readonly string[] => {
  const revision = gitOutput(
    ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"],
    environment,
  );
  if (revision === null) return [];

  const [repositoryRoot, gitCommonDirectory] = revision.split("\n");
  if (repositoryRoot === undefined || gitCommonDirectory === undefined) return [];

  return [join(gitCommonDirectory, "info", "exclude"), join(repositoryRoot, ".gitignore")];
};

const patternsOf = (excludeFile: string): readonly string[] => {
  const fileText = readTextFile(excludeFile);
  return fileText === null ? [] : ignoreFilePatterns(fileText);
};

export const gitExcludePatterns = (
  environment: GitEnvironment = { cwd: process.cwd(), env: process.env },
): readonly string[] =>
  [globalExcludeFile(environment), ...repositoryExcludeFiles(environment)].flatMap(patternsOf);
