import { execFileSync } from "node:child_process";

import { attempt } from "es-toolkit";

import { isEnvironmentFailure } from "./path-failure.ts";

export type GitEnvironment = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

export const repositoryAgnosticGitEnvironment = (
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv => {
  const {
    GIT_ALTERNATE_OBJECT_DIRECTORIES,
    GIT_COMMON_DIR,
    GIT_CONFIG,
    GIT_CONFIG_COUNT,
    GIT_CONFIG_PARAMETERS,
    GIT_DIR,
    GIT_GRAFT_FILE,
    GIT_IMPLICIT_WORK_TREE,
    GIT_INDEX_FILE,
    GIT_NO_REPLACE_OBJECTS,
    GIT_OBJECT_DIRECTORY,
    GIT_PREFIX,
    GIT_REPLACE_REF_BASE,
    GIT_SHALLOW_FILE,
    GIT_WORK_TREE,
    ...repositoryAgnosticEnvironment
  } = environment;
  return repositoryAgnosticEnvironment;
};

const answeredWithoutValue = (failure: unknown): boolean =>
  typeof failure === "object" &&
  failure !== null &&
  "status" in failure &&
  typeof failure.status === "number";

export const gitOutput = (args: readonly string[], environment: GitEnvironment): string | null => {
  const [unaskableGit, answer] = attempt<string, Error>(() =>
    execFileSync("git", [...args], {
      cwd: environment.cwd,
      encoding: "utf8",
      env: repositoryAgnosticGitEnvironment(environment.env),
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  if (unaskableGit === null) return answer.trim();

  if (answeredWithoutValue(unaskableGit) || isEnvironmentFailure(unaskableGit)) return null;
  throw new Error(`git ${args.join(" ")} could not be run`, { cause: unaskableGit });
};
