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

describe("renderMarkdown", () => {
  test("見出しと PR 節を持つ", () => {
    const markdown = renderMarkdown(baseContext);
    expect([
      markdown.startsWith("# PR Context"),
      markdown.includes("- PR: #7"),
      markdown.includes("- Base: main"),
      markdown.includes("- Head: topic/x"),
    ]).toStrictEqual([true, true, true, true]);
  });

  test("本文ありは included、省略は理由付き、理由なしは not available", () => {
    const markdown = renderMarkdown({
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
    });
    expect([
      markdown.includes("| M | a.ts | included |"),
      markdown.includes("| D | b.ts | omitted: deleted |"),
      markdown.includes("| A | c.ts | omitted: not available |"),
    ]).toStrictEqual([true, true, true]);
  });

  test("スレッド集計は未解決・outdated・outdated かつ未解決を別々に数える", () => {
    const markdown = renderMarkdown({
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
    });
    expect([
      markdown.includes("- Unresolved threads: 2"),
      markdown.includes("- Outdated threads: 2"),
      markdown.includes("- Outdated and unresolved threads: 1"),
    ]).toStrictEqual([true, true, true]);
  });

  test("CI 詳細リンク欠損は空セル、失敗ログ 0 件は 1 文になる", () => {
    const markdown = renderMarkdown({
      ...baseContext,
      ci: {
        checks: [
          { name: "build", state: "failure", bucket: "fail", detailsUrl: null, workflowName: "ci" },
        ],
        failedLogPaths: [],
      },
    });
    expect([
      markdown.includes("| build | failure | fail |  |"),
      markdown.includes("No failed CI logs were downloaded."),
    ]).toStrictEqual([true, true]);
  });

  test("パイプと改行はエスケープされる", () => {
    const markdown = renderMarkdown({
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
    });
    expect(markdown).toContain("a\\|b<br>c.ts");
  });

  test("CI 詳細リンクがあればセルに入る", () => {
    const markdown = renderMarkdown({
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
    });
    expect(markdown).toContain("| build | success | pass | https://ci.example/build |");
  });

  test("失敗ログがあれば一覧で並ぶ", () => {
    const markdown = renderMarkdown({
      ...baseContext,
      ci: { checks: [], failedLogPaths: ["ci-logs/build.log"] },
    });
    expect([
      markdown.includes("Failed CI logs:"),
      markdown.includes("- ci-logs/build.log"),
    ]).toStrictEqual([true, true]);
  });
});
