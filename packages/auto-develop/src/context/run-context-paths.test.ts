import { describe, expect, test } from "vite-plus/test";

import { runContextLayout, runIdFor } from "./run-context-paths.ts";

describe("runIdFor", () => {
  const it = test.extend("runIdForPrSeven", () =>
    runIdFor({ prNumber: 7, isoTime: "2026-08-11T00:00:00.000Z" }));

  it("PR 番号と、ISO の : と . を - へ置換したスラッグを繋ぐ", ({ runIdForPrSeven }) => {
    expect(runIdForPrSeven).toStrictEqual("7-2026-08-11T00-00-00-000Z");
  });
});

describe("runContextLayout", () => {
  const it = test
    .extend("reviewerLayoutStatingRunRoot", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "reviewer", runId: "7-t" }))
    .extend("authorLayoutStatingRunRoot", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" }),
    )
    .extend("reviewerLayoutStatingRunContextDir", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "reviewer", runId: "7-t" }),
    )
    .extend("authorLayoutStatingFindings", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" }),
    )
    .extend("authorLayoutStatingInventory", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" }),
    )
    .extend("authorLayoutStatingPlannedComments", () =>
      runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" }),
    );

  it("reviewer の実行ルートは review ディレクトリを使う", ({ reviewerLayoutStatingRunRoot }) => {
    expect(reviewerLayoutStatingRunRoot).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/review/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/review/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/review/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/review/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t",
    });
  });

  it("author の実行ルートは author ディレクトリを使う", ({ authorLayoutStatingRunRoot }) => {
    expect(authorLayoutStatingRunRoot).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/author/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/author/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t",
    });
  });

  it("run context のサブディレクトリはモード名そのままを使う", ({
    reviewerLayoutStatingRunContextDir,
  }) => {
    expect(reviewerLayoutStatingRunContextDir).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/review/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/review/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/review/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/review/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t",
    });
  });

  it("findings は実行ルート配下に並ぶ", ({ authorLayoutStatingFindings }) => {
    expect(authorLayoutStatingFindings).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/author/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/author/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t",
    });
  });

  it("インベントリは実行ルート配下に並ぶ", ({ authorLayoutStatingInventory }) => {
    expect(authorLayoutStatingInventory).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/author/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/author/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t",
    });
  });

  it("投稿予定は実行ルート配下に並ぶ", ({ authorLayoutStatingPlannedComments }) => {
    expect(authorLayoutStatingPlannedComments).toStrictEqual({
      runRootDir: "/work/pr-7/.repo-workflow/author/7-t",
      findingsDir: "/work/pr-7/.repo-workflow/author/7-t/findings",
      inventoryJsonPath: "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
      plannedCommentsJsonPath: "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
      runContextJsonPath:
        "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t/run-context.json",
      runContextDir: "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-t",
    });
  });
});
