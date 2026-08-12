import { describe, expect, test } from "vite-plus/test";

import {
  LAUNCH_AUTO,
  parseRunContext,
  RUN_CONTEXT_SCHEMA_VERSION,
  safeParseRunContext,
} from "./run-context.ts";

const validContext = {
  schemaVersion: RUN_CONTEXT_SCHEMA_VERSION,
  mode: "reviewer",
  launchPath: LAUNCH_AUTO,
  prNumber: 7,
  baseRef: "origin/main",
  headRef: "topic/x",
  createdAt: "2026-08-11T00:00:00.000Z",
  git: { worktreePath: "/work/pr-7" },
  artifacts: {
    prContextJsonPath: "/work/pr-7/ctx.json",
    prContextMarkdownPath: "/work/pr-7/ctx.md",
    failedCiLogsDir: "/work/pr-7/ci-logs",
  },
  workflow: {
    runId: "7-2026-08-11T00-00-00-000Z",
    runRootDir: "/work/pr-7/.repo-workflow/review/7",
    findingsDir: "/work/pr-7/.repo-workflow/review/7/findings",
    inventoryJsonPath: "/work/pr-7/.repo-workflow/review/7/inventory.json",
    plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/review/7/planned-comments.json",
  },
};

describe("parseRunContext", () => {
  test("妥当なコンテキストはそのまま通る", () => {
    expect(parseRunContext(validContext).prNumber).toStrictEqual(7);
  });

  test("スキーマ版数が違えば例外になる", () => {
    expect(() => parseRunContext({ ...validContext, schemaVersion: 2 })).toThrow("Invalid");
  });

  test("PR 番号が正整数でなければ例外になる", () => {
    expect(() => parseRunContext({ ...validContext, prNumber: 0 })).toThrow("Too small");
  });

  test("モードが語彙外なら例外になる", () => {
    expect(() => parseRunContext({ ...validContext, mode: "other" })).toThrow("invalid mode");
  });
});

describe("safeParseRunContext", () => {
  test("妥当なら値、不正なら null を返す", () => {
    expect([
      safeParseRunContext(validContext)?.mode,
      safeParseRunContext({ broken: true }),
    ]).toStrictEqual(["reviewer", null]);
  });
});
