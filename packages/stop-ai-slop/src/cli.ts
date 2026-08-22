#!/usr/bin/env node
import { emitCliReport } from "@mst/repository-checks";

import { runStopAiSlop } from "./run-cli.ts";

emitCliReport(await runStopAiSlop(process.argv.slice(2)), {
  writeOutput: process.stdout.write.bind(process.stdout),
  writeError: process.stderr.write.bind(process.stderr),
  setExitCode: (exitCode) => {
    process.exitCode = exitCode;
  },
});
