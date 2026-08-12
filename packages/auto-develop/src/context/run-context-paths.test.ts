import { describe, expect, test } from "vite-plus/test";

import { runContextLayout, runIdFor, timestampSlug } from "./run-context-paths.ts";

describe("timestampSlug", () => {
  test("ISO の : と . を - に置換する", () => {
    expect(timestampSlug("2026-08-11T00:00:00.000Z")).toStrictEqual("2026-08-11T00-00-00-000Z");
  });
});

describe("runIdFor", () => {
  test("PR 番号とタイムスタンプスラッグを繋ぐ", () => {
    expect(runIdFor({ prNumber: 7, isoTime: "2026-08-11T00:00:00.000Z" })).toStrictEqual(
      "7-2026-08-11T00-00-00-000Z",
    );
  });
});

describe("runContextLayout", () => {
  test("reviewer の実行ルートは review ディレクトリを使う", () => {
    const layout = runContextLayout({ worktreePath: "/work/pr-7", mode: "reviewer", runId: "7-t" });
    expect(layout.runRootDir).toStrictEqual("/work/pr-7/.repo-workflow/review/7-t");
  });

  test("author の実行ルートは author ディレクトリを使う", () => {
    const layout = runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" });
    expect(layout.runRootDir).toStrictEqual("/work/pr-7/.repo-workflow/author/7-t");
  });

  test("run context のサブディレクトリはモード名そのままを使う", () => {
    const layout = runContextLayout({ worktreePath: "/work/pr-7", mode: "reviewer", runId: "7-t" });
    expect(layout.runContextJsonPath).toStrictEqual(
      "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t/run-context.json",
    );
  });

  test("findings とインベントリと投稿予定は実行ルート配下に並ぶ", () => {
    const layout = runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" });
    expect([
      layout.findingsDir,
      layout.inventoryJsonPath,
      layout.plannedCommentsJsonPath,
    ]).toStrictEqual([
      "/work/pr-7/.repo-workflow/author/7-t/findings",
      "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
      "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
    ]);
  });
});
