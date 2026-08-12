import { join } from "node:path";

import type { Mode } from "./run-context.ts";

const WORKFLOW_ROOT = ".repo-workflow";

const RUN_ROOT_DIRECTORY: Readonly<Record<Mode, string>> = {
  reviewer: "review",
  author: "author",
};

const timestampSlug = (isoTime: string): string =>
  isoTime.replaceAll(":", "-").replaceAll(".", "-");

export const runIdFor = (build: { readonly prNumber: number; readonly isoTime: string }): string =>
  `${build.prNumber}-${timestampSlug(build.isoTime)}`;

export type RunContextLayout = {
  readonly runRootDir: string;
  readonly findingsDir: string;
  readonly inventoryJsonPath: string;
  readonly plannedCommentsJsonPath: string;
  readonly runContextJsonPath: string;
  readonly runContextDir: string;
};

export const runContextLayout = (build: {
  readonly worktreePath: string;
  readonly mode: Mode;
  readonly runId: string;
}): RunContextLayout => {
  const runRootDir = join(
    build.worktreePath,
    WORKFLOW_ROOT,
    RUN_ROOT_DIRECTORY[build.mode],
    build.runId,
  );
  const runContextDir = join(
    build.worktreePath,
    WORKFLOW_ROOT,
    "auto-develop",
    "run-context",
    `${build.mode}-${build.runId}`,
  );
  return {
    runRootDir,
    findingsDir: join(runRootDir, "findings"),
    inventoryJsonPath: join(runRootDir, "inventory.json"),
    plannedCommentsJsonPath: join(runRootDir, "planned-comments.json"),
    runContextJsonPath: join(runContextDir, "run-context.json"),
    runContextDir,
  };
};
