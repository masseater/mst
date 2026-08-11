#!/usr/bin/env node
import { runAutoDevelop } from "./run-cli.ts";

const { exitCode, out, error } = runAutoDevelop();

if (out !== "") process.stdout.write(out);
if (error !== "") process.stderr.write(error);

process.exitCode = exitCode;
