#!/usr/bin/env node
import { runHook } from "cc-hooks-ts";

import { hook } from "./hook.ts";

await runHook(hook);
