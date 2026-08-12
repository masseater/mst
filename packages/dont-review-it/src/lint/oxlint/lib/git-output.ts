import { execFileSync } from "node:child_process";

import { attempt } from "es-toolkit";

import { isEnvironmentFailure } from "./path-failure.ts";

export type GitEnvironment = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

const answeredWithoutValue = (failure: unknown): boolean =>
  typeof failure === "object" &&
  failure !== null &&
  "status" in failure &&
  typeof failure.status === "number";

export const gitOutput = (
  handedArgs: readonly string[],
  environment: GitEnvironment,
): string | null => {
  const {
    GIT_COMMON_DIR,
    GIT_DIR,
    GIT_INDEX_FILE,
    GIT_OBJECT_DIRECTORY,
    GIT_PREFIX,
    GIT_WORK_TREE,
    ...repositoryAgnosticEnv
  } = environment.env;
  const [unaskableGit, produced] = attempt<string, Error>(() =>
    execFileSync("git", [...handedArgs], {
      cwd: environment.cwd,
      encoding: "utf8",
      env: repositoryAgnosticEnv,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  if (unaskableGit === null) return produced.trim();

  if (answeredWithoutValue(unaskableGit) || isEnvironmentFailure(unaskableGit)) return null;
  throw new Error(`git ${handedArgs.join(" ")} could not be run`, { cause: unaskableGit });
};
