#!/usr/bin/env node
import { runDontReviewIt } from "./run-cli.ts";

const { exitCode, out, error } = runDontReviewIt(process.argv.slice(2));

if (out !== "") process.stdout.write(out);
if (error !== "") process.stderr.write(error);

process.exitCode = exitCode;
