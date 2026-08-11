#!/usr/bin/env node
import { runLintRuleAuthoring } from "./run-cli.ts";

const { exitCode, out, error } = runLintRuleAuthoring(process.argv.slice(2));

if (out !== "") process.stdout.write(out);
if (error !== "") process.stderr.write(error);

process.exitCode = exitCode;
