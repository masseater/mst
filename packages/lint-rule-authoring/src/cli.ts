#!/usr/bin/env node
import { emitCliReport } from "@mst/repository-checks";

import { runLintRuleAuthoring } from "./run-cli.ts";

emitCliReport(runLintRuleAuthoring(process.argv.slice(2)), {
  writeOutput: process.stdout.write.bind(process.stdout),
  writeError: process.stderr.write.bind(process.stderr),
  setExitCode: (exitCode) => {
    process.exitCode = exitCode;
  },
});
