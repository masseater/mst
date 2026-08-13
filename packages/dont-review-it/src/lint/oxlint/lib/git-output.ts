import { execFileSync } from "node:child_process";

import { gitExecutablePath } from "@mst/repository-checks";
import { attempt, omitBy } from "es-toolkit";

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
  gitArguments: readonly string[],
  environment: GitEnvironment,
): string | null => {
  const repositoryAgnosticEnv = omitBy(environment.env, (_, environmentName) =>
    String(environmentName).startsWith("GIT_"),
  );
  const [unaskableGit, gitStdout] = attempt<string, Error>(() =>
    execFileSync(gitExecutablePath(repositoryAgnosticEnv.PATH), [...gitArguments], {
      cwd: environment.cwd,
      encoding: "utf8",
      env: repositoryAgnosticEnv,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  if (unaskableGit === null) return gitStdout.trim();

  if (answeredWithoutValue(unaskableGit) || isEnvironmentFailure(unaskableGit)) return null;
  throw new Error(`git ${gitArguments.join(" ")} could not be run`, { cause: unaskableGit });
};
