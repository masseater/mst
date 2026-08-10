#!/usr/bin/env node
import { runDontReviewIt } from "./run-cli.ts";

process.exitCode = runDontReviewIt(process.argv.slice(2), {
  writeOut: (text) => {
    process.stdout.write(text);
  },
  writeError: (text) => {
    process.stderr.write(text);
  },
});
