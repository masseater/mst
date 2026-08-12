#!/usr/bin/env node
import { runMain } from "citty";

import { autoDevelopCommand } from "./cli/runtime-command.ts";

await runMain(autoDevelopCommand);
