import { describe, expect, test } from "vite-plus/test";

import { LAUNCH_AUTO, parseRunContext } from "./run-context.ts";

const validRunContext = {
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

describe("parseRunContext", () => {
  const it = test
    .extend("acceptedRunContext", () => parseRunContext(validRunContext))
    .extend("schemaVersionRejectionText", () => {
      try {
        parseRunContext({ ...validRunContext, schemaVersion: 2 });
      } catch (schemaVersionFailure) {
        return String(schemaVersionFailure);
      }
    })
    .extend("prNumberRejectionText", () => {
      try {
        parseRunContext({ ...validRunContext, prNumber: 0 });
      } catch (prNumberFailure) {
        return String(prNumberFailure);
      }
    })
    .extend("modeRejectionText", () => {
      try {
        parseRunContext({ ...validRunContext, mode: "other" });
      } catch (modeFailure) {
        return String(modeFailure);
      }
    });

  it("妥当なコンテキストはそのまま通る", ({ acceptedRunContext }) => {
    expect(acceptedRunContext).toStrictEqual(validRunContext);
  });

  it("スキーマ版数が違えば例外になる", ({ schemaVersionRejectionText }) => {
    expect(schemaVersionRejectionText).toBe(`[
  {
    "code": "invalid_value",
    "values": [
      1
    ],
    "path": [
      "schemaVersion"
    ],
    "message": "Invalid input: expected 1"
  }
]`);
  });

  it("PR 番号が正整数でなければ例外になる", ({ prNumberRejectionText }) => {
    expect(prNumberRejectionText).toBe(`[
  {
    "origin": "number",
    "code": "too_small",
    "minimum": 0,
    "inclusive": false,
    "path": [
      "prNumber"
    ],
    "message": "Too small: expected number to be >0"
  }
]`);
  });

  it("モードが語彙外なら例外になる", ({ modeRejectionText }) => {
    expect(modeRejectionText).toBe(`[
  {
    "code": "custom",
    "path": [
      "mode"
    ],
    "message": "invalid mode"
  }
]`);
  });
});
