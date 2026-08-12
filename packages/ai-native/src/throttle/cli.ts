#!/usr/bin/env node
import { runThrottle } from "./run-throttle.ts";

process.exitCode = await runThrottle(process.argv.slice(2));
