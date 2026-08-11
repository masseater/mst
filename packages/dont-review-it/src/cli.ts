#!/usr/bin/env node
import { runMain } from "citty";

import { dontReviewItCommand } from "./dont-review-it-command.ts";

await runMain(dontReviewItCommand);
