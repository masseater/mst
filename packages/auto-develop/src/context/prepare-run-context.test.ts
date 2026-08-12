import { describe, expect, test, vi } from "vite-plus/test";

import { prepareRunContext, type RunContextFs } from "./prepare-run-context.ts";
import { LAUNCH_AUTO, type RunContext } from "./run-context.ts";

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

const prepareWith = (
  spelledMode: "reviewer" | "author",
): {
  readonly runContext: RunContext;
  readonly mkdirCount: number;
  readonly firstWrittenPath: string | undefined;
} => {
  const mkdirRecursive = vi.fn<(dir: string) => void>();
  const writeJson = vi.fn<(path: string, value: unknown) => void>();
  const fs: RunContextFs = { mkdirRecursive, writeJson };
  const runContext = prepareRunContext({
    request: { ...baseRequest, mode: spelledMode },
    fs,
    nowIso: () => "2026-08-11T00:00:00.000Z",
  });
  return {
    runContext,
    mkdirCount: mkdirRecursive.mock.calls.length,
    firstWrittenPath: writeJson.mock.calls[0]?.[0],
  };
};

const it = test
  .extend("reviewerPreparation", () => prepareWith("reviewer"))
  .extend("authorPreparation", () => prepareWith("author"));

describe("prepareRunContext", () => {
  it("実行 ID は PR 番号とタイムスタンプから決まる", ({ reviewerPreparation }) => {
    expect(reviewerPreparation.runContext.workflow.runId).toStrictEqual(
      "7-2026-08-11T00-00-00-000Z",
    );
  });

  it("findings と run context の親ディレクトリを作る", ({ reviewerPreparation }) => {
    expect(reviewerPreparation.mkdirCount).toStrictEqual(2);
  });

  it("run context の JSON を書く", ({ reviewerPreparation }) => {
    expect(reviewerPreparation.firstWrittenPath).toStrictEqual(
      "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-11T00-00-00-000Z/run-context.json",
    );
  });

  it("書き出す値はスキーマ検証を通った run context である", ({ authorPreparation }) => {
    expect(authorPreparation.runContext.schemaVersion).toStrictEqual(1);
  });

  it("書き出す値は要求されたモードを持つ", ({ authorPreparation }) => {
    expect(authorPreparation.runContext.mode).toStrictEqual("author");
  });
});
