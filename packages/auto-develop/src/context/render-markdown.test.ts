import { describe, expect, test } from "vite-plus/test";

import { renderMarkdown } from "./render-markdown.ts";

import type { PrContext } from "./pr-context.ts";

const baseContext: PrContext = {
  prNumber: 7,
  base: "main",
  head: "topic/x",
  diff: "",
  changedFiles: [],
  comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
  ci: { checks: [], failedLogPaths: [] },
};

const it = test
  .extend("emptyMarkdown", () => renderMarkdown(baseContext))
  .extend("changedFilesMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      changedFiles: [
        { statusCode: "M", path: "a.ts", previousPath: null, content: "x", omissionReason: null },
        {
          statusCode: "D",
          path: "b.ts",
          previousPath: null,
          content: null,
          omissionReason: "deleted",
        },
        { statusCode: "A", path: "c.ts", previousPath: null, content: null, omissionReason: null },
      ],
    }),
  )
  .extend("threadSummaryMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      comments: {
        reviews: [],
        prComments: [],
        inlineComments: [],
        threads: [
          { id: "1", resolved: false, outdated: true, path: "a", line: 1, comments: [] },
          { id: "2", resolved: true, outdated: true, path: "b", line: 2, comments: [] },
          { id: "3", resolved: false, outdated: false, path: "c", line: 3, comments: [] },
        ],
      },
    }),
  )
  .extend("failingCheckMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      ci: {
        checks: [
          { name: "build", state: "failure", bucket: "fail", detailsUrl: null, workflowName: "ci" },
        ],
        failedLogPaths: [],
      },
    }),
  )
  .extend("escapedPathMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      changedFiles: [
        {
          statusCode: "M",
          path: "a|b\nc.ts",
          previousPath: null,
          content: "x",
          omissionReason: null,
        },
      ],
    }),
  )
  .extend("linkedCheckMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      ci: {
        checks: [
          {
            name: "build",
            state: "success",
            bucket: "pass",
            detailsUrl: "https://ci.example/build",
            workflowName: "ci",
          },
        ],
        failedLogPaths: [],
      },
    }),
  )
  .extend("failedLogsMarkdown", () =>
    renderMarkdown({
      ...baseContext,
      ci: { checks: [], failedLogPaths: ["ci-logs/build.log"] },
    }),
  );

describe("renderMarkdown", () => {
  it("見出しから始まる", ({ emptyMarkdown }) => {
    expect(emptyMarkdown).toMatch(/^# PR Context/u);
  });

  it("PR 節は PR 番号を持つ", ({ emptyMarkdown }) => {
    expect(emptyMarkdown).toContain("- PR: #7");
  });

  it("PR 節は base を持つ", ({ emptyMarkdown }) => {
    expect(emptyMarkdown).toContain("- Base: main");
  });

  it("PR 節は head を持つ", ({ emptyMarkdown }) => {
    expect(emptyMarkdown).toContain("- Head: topic/x");
  });

  it("本文ありは included になる", ({ changedFilesMarkdown }) => {
    expect(changedFilesMarkdown).toContain("| M | a.ts | included |");
  });

  it("省略は理由付きになる", ({ changedFilesMarkdown }) => {
    expect(changedFilesMarkdown).toContain("| D | b.ts | omitted: deleted |");
  });

  it("理由なしの省略は not available になる", ({ changedFilesMarkdown }) => {
    expect(changedFilesMarkdown).toContain("| A | c.ts | omitted: not available |");
  });

  it("スレッド集計は未解決を数える", ({ threadSummaryMarkdown }) => {
    expect(threadSummaryMarkdown).toContain("- Unresolved threads: 2");
  });

  it("スレッド集計は outdated を数える", ({ threadSummaryMarkdown }) => {
    expect(threadSummaryMarkdown).toContain("- Outdated threads: 2");
  });

  it("スレッド集計は outdated かつ未解決を別に数える", ({ threadSummaryMarkdown }) => {
    expect(threadSummaryMarkdown).toContain("- Outdated and unresolved threads: 1");
  });

  it("CI 詳細リンク欠損は空セルになる", ({ failingCheckMarkdown }) => {
    expect(failingCheckMarkdown).toContain("| build | failure | fail |  |");
  });

  it("失敗ログ 0 件は 1 文になる", ({ failingCheckMarkdown }) => {
    expect(failingCheckMarkdown).toContain("No failed CI logs were downloaded.");
  });

  it("パイプと改行はエスケープされる", ({ escapedPathMarkdown }) => {
    expect(escapedPathMarkdown).toContain(String.raw`a\|b<br>c.ts`);
  });

  it("CI 詳細リンクがあればセルに入る", ({ linkedCheckMarkdown }) => {
    expect(linkedCheckMarkdown).toContain("| build | success | pass | https://ci.example/build |");
  });

  it("失敗ログがあれば見出しが付く", ({ failedLogsMarkdown }) => {
    expect(failedLogsMarkdown).toContain("Failed CI logs:");
  });

  it("失敗ログがあれば一覧で並ぶ", ({ failedLogsMarkdown }) => {
    expect(failedLogsMarkdown).toContain("- ci-logs/build.log");
  });
});
