#!/usr/bin/env node
import { runMain } from "citty";

import { createModeRunner } from "./cli/run-mode.ts";
import { createAutoDevelopCommand } from "./cli/runtime-command.ts";
import { readEnvVar } from "./config/env.ts";

await runMain(
  createAutoDevelopCommand({
    readEnvironment: readEnvVar,
    runMode: createModeRunner(),
  }),
);
