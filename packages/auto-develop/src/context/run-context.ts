import { z } from "zod";

import { isMode, type Mode } from "../contract/vocabulary.ts";

const RUN_CONTEXT_SCHEMA_VERSION = 1;

const LAUNCH_PATHS = ["auto", "manual"] as const;

export type LaunchPath = (typeof LAUNCH_PATHS)[number];

export const LAUNCH_AUTO: LaunchPath = "auto";

const isLaunchPath = (candidate: unknown): candidate is LaunchPath =>
  (LAUNCH_PATHS as readonly unknown[]).includes(candidate);

const runContextSchema = z.object({
  schemaVersion: z.literal(RUN_CONTEXT_SCHEMA_VERSION),
  mode: z.string().refine(isMode, { message: "invalid mode" }),
  launchPath: z.string().refine(isLaunchPath, { message: "invalid launch path" }),
  prNumber: z.number().int().positive(),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  createdAt: z.iso.datetime(),
  git: z.object({ worktreePath: z.string().min(1) }),
  artifacts: z.object({
    prContextJsonPath: z.string().min(1),
    prContextMarkdownPath: z.string().min(1),
    failedCiLogsDir: z.string().min(1),
  }),
  workflow: z.object({
    runId: z.string().min(1),
    runRootDir: z.string().min(1),
    findingsDir: z.string().min(1),
    inventoryJsonPath: z.string().min(1),
    plannedCommentsJsonPath: z.string().min(1),
  }),
});

export type { Mode };

export type RunContext = z.infer<typeof runContextSchema>;

export const parseRunContext = (candidate: unknown): RunContext =>
  runContextSchema.parse(candidate);
