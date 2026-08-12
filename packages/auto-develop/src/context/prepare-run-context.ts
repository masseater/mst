import { runContextLayout, runIdFor } from "./run-context-paths.ts";
import { parseRunContext, type LaunchPath, type Mode, type RunContext } from "./run-context.ts";

export type RunContextFs = {
  readonly mkdirRecursive: (dir: string) => void;
  readonly writeJson: (path: string, value: unknown) => void;
};

export type PrepareRunContextRequest = {
  readonly worktreePath: string;
  readonly mode: Mode;
  readonly launchPath: LaunchPath;
  readonly prNumber: number;
  readonly baseRef: string;
  readonly headRef: string;
  readonly prContextJsonPath: string;
  readonly prContextMarkdownPath: string;
  readonly failedCiLogsDir: string;
};

export const prepareRunContext = (prepare: {
  readonly request: PrepareRunContextRequest;
  readonly fs: RunContextFs;
  readonly nowIso: () => string;
}): RunContext => {
  const { request } = prepare;
  const createdAt = prepare.nowIso();
  const runId = runIdFor({ prNumber: request.prNumber, isoTime: createdAt });
  const layout = runContextLayout({
    worktreePath: request.worktreePath,
    mode: request.mode,
    runId,
  });
  const runContext = parseRunContext({
    schemaVersion: 1,
    mode: request.mode,
    launchPath: request.launchPath,
    prNumber: request.prNumber,
    baseRef: request.baseRef,
    headRef: request.headRef,
    createdAt,
    git: { worktreePath: request.worktreePath },
    artifacts: {
      prContextJsonPath: request.prContextJsonPath,
      prContextMarkdownPath: request.prContextMarkdownPath,
      failedCiLogsDir: request.failedCiLogsDir,
    },
    workflow: {
      runId,
      runRootDir: layout.runRootDir,
      findingsDir: layout.findingsDir,
      inventoryJsonPath: layout.inventoryJsonPath,
      plannedCommentsJsonPath: layout.plannedCommentsJsonPath,
    },
  });
  prepare.fs.mkdirRecursive(layout.findingsDir);
  prepare.fs.mkdirRecursive(layout.runContextDir);
  prepare.fs.writeJson(layout.runContextJsonPath, runContext);
  return runContext;
};
