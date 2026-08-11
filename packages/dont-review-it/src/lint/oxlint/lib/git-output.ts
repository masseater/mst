import { execFileSync } from "node:child_process";

import { attempt, omit } from "es-toolkit";

import { isEnvironmentFailure } from "./path-failure.ts";

export type GitEnvironment = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

const REPOSITORY_LOCATING_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_WORK_TREE",
];

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
      env: omit(environment.env, REPOSITORY_LOCATING_VARIABLES),
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  if (unaskableGit === null) return answer.trim();

  if (answeredWithoutValue(unaskableGit) || isEnvironmentFailure(unaskableGit)) return null;
  throw new Error(`git ${args.join(" ")} could not be run`, { cause: unaskableGit });
};
