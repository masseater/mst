import { join } from "node:path";

import { readEnvVar } from "./env.ts";

export const LOG_DIR_ENV_VAR = "AUTO_DEVELOP_LOG_DIR";

export const resolveLogDirectory = (
  repoRoot: string,
  env: Readonly<Record<string, unknown>> = process.env,
): string => readEnvVar(LOG_DIR_ENV_VAR, env) ?? join(repoRoot, "logs");
