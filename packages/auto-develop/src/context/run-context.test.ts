import { describe, expect, test } from "vite-plus/test";

import { LAUNCH_AUTO, parseRunContext } from "./run-context.ts";

const validContext = {
  schemaVersion: 1,
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

const rejectionTextOf = (candidate: unknown): string => {
  try {
    parseRunContext(candidate);
    return "no failure";
  } catch (parseFailure) {
    return String(parseFailure);
  }
};

const it = test
  .extend("acceptedContext", () => parseRunContext(validContext))
  .extend("schemaVersionRejection", () => rejectionTextOf({ ...validContext, schemaVersion: 2 }))
  .extend("prNumberRejection", () => rejectionTextOf({ ...validContext, prNumber: 0 }))
  .extend("modeRejection", () => rejectionTextOf({ ...validContext, mode: "other" }));

describe("parseRunContext", () => {
  it("妥当なコンテキストはそのまま通る", ({ acceptedContext }) => {
    expect(acceptedContext.prNumber).toStrictEqual(7);
  });

  it("スキーマ版数が違えば例外になる", ({ schemaVersionRejection }) => {
    expect(schemaVersionRejection).toContain("Invalid");
  });

  it("PR 番号が正整数でなければ例外になる", ({ prNumberRejection }) => {
    expect(prNumberRejection).toContain("Too small");
  });

  it("モードが語彙外なら例外になる", ({ modeRejection }) => {
    expect(modeRejection).toContain("invalid mode");
  });
});
