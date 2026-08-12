import { describe, expect, test } from "vite-plus/test";

import { runContextLayout, runIdFor } from "./run-context-paths.ts";

const it = test
  .extend("runIdForPrSeven", () => runIdFor({ prNumber: 7, isoTime: "2026-08-11T00:00:00.000Z" }))
  .extend("reviewerLayout", () =>
    runContextLayout({ worktreePath: "/work/pr-7", mode: "reviewer", runId: "7-t" }),
  )
  .extend("authorLayout", () =>
    runContextLayout({ worktreePath: "/work/pr-7", mode: "author", runId: "7-t" }),
  );

describe("runIdFor", () => {
  it("PR 番号と、ISO の : と . を - へ置換したスラッグを繋ぐ", ({ runIdForPrSeven }) => {
    expect(runIdForPrSeven).toStrictEqual("7-2026-08-11T00-00-00-000Z");
  });
});

describe("runContextLayout", () => {
  it("reviewer の実行ルートは review ディレクトリを使う", ({ reviewerLayout }) => {
    expect(reviewerLayout.runRootDir).toStrictEqual("/work/pr-7/.repo-workflow/review/7-t");
  });

  it("author の実行ルートは author ディレクトリを使う", ({ authorLayout }) => {
    expect(authorLayout.runRootDir).toStrictEqual("/work/pr-7/.repo-workflow/author/7-t");
  });

  it("run context のサブディレクトリはモード名そのままを使う", ({ reviewerLayout }) => {
    expect(reviewerLayout.runContextJsonPath).toStrictEqual(
      "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-t/run-context.json",
    );
  });

  it("findings は実行ルート配下に並ぶ", ({ authorLayout }) => {
    expect(authorLayout.findingsDir).toStrictEqual("/work/pr-7/.repo-workflow/author/7-t/findings");
  });

  it("インベントリは実行ルート配下に並ぶ", ({ authorLayout }) => {
    expect(authorLayout.inventoryJsonPath).toStrictEqual(
      "/work/pr-7/.repo-workflow/author/7-t/inventory.json",
    );
  });

  it("投稿予定は実行ルート配下に並ぶ", ({ authorLayout }) => {
    expect(authorLayout.plannedCommentsJsonPath).toStrictEqual(
      "/work/pr-7/.repo-workflow/author/7-t/planned-comments.json",
    );
  });
});
