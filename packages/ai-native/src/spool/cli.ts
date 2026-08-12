#!/usr/bin/env node
import process from "node:process";

import { runSpool } from "./run-spool.ts";

process.exitCode = await runSpool(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
