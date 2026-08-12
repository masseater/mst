import { describe, expect, test, vi } from "vite-plus/test";

import { prepareRunContext, type RunContextFs } from "./prepare-run-context.ts";
import { LAUNCH_AUTO } from "./run-context.ts";

const baseRequest = {
  worktreePath: "/work/pr-7",
  mode: "reviewer" as const,
  launchPath: LAUNCH_AUTO,
  prNumber: 7,
  baseRef: "origin/main",
  headRef: "topic/x",
  prContextJsonPath: "/work/pr-7/ctx.json",
  prContextMarkdownPath: "/work/pr-7/ctx.md",
  failedCiLogsDir: "/work/pr-7/ci-logs",
};

describe("prepareRunContext", () => {
  test("findings と run context の親ディレクトリを作り JSON を書く", () => {
    const mkdirRecursive = vi.fn<(dir: string) => void>();
    const writeJson = vi.fn<(path: string, value: unknown) => void>();
    const fs: RunContextFs = { mkdirRecursive, writeJson };
    const runContext = prepareRunContext({
      request: baseRequest,
      fs,
      nowIso: () => "2026-08-11T00:00:00.000Z",
    });
    expect([
      runContext.workflow.runId,
      mkdirRecursive.mock.calls.length,
      writeJson.mock.calls[0]?.[0],
    ]).toStrictEqual([
      "7-2026-08-11T00-00-00-000Z",
      2,
      "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-11T00-00-00-000Z/run-context.json",
    ]);
  });

  test("書き出す値はスキーマ検証を通った run context である", () => {
    const fs: RunContextFs = { mkdirRecursive: () => undefined, writeJson: () => undefined };
    const runContext = prepareRunContext({
      request: { ...baseRequest, mode: "author" },
      fs,
      nowIso: () => "2026-08-11T00:00:00.000Z",
    });
    expect([runContext.mode, runContext.schemaVersion]).toStrictEqual(["author", 1]);
  });
});
