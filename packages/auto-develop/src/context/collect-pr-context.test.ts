import { describe, expect, test } from "vite-plus/test";

import { collectPrContext, type PrContextGit, type PrContextGithub } from "./collect-pr-context.ts";

const emptyGithub: PrContextGithub = {
  commentContext: () =>
    Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
  ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
};

const gitWith = (overrides: Partial<PrContextGit>): PrContextGit => ({
  nameStatusDiff: () => Promise.resolve(""),
  unifiedDiff: () => Promise.resolve("diff text"),
  treeEntryMode: () => Promise.resolve("100644"),
  showFile: () => Promise.resolve("file content"),
  ...overrides,
});

const collectWith = (git: PrContextGit) =>
  collectPrContext({
    git,
    github: emptyGithub,
    prNumber: 7,
    base: "main",
    head: "topic/x",
    failedLogsDir: "/logs",
  });

describe("collectPrContext", () => {
  test("削除ファイルは git show を呼ばず理由 deleted になる", async () => {
    const shown = new Map<number, string>();
    const git = gitWith({
      nameStatusDiff: () => Promise.resolve("D\tsrc/gone.ts"),
      showFile: ({ path }) => {
        shown.set(shown.size, path);
        return Promise.resolve("");
      },
    });
    const context = await collectWith(git);
    expect([context.changedFiles[0]?.omissionReason, shown.size]).toStrictEqual(["deleted", 0]);
  });

  test("gitlink モードは git show を呼ばず理由 submodule になる", async () => {
    const shown = new Map<number, string>();
    const git = gitWith({
      nameStatusDiff: () => Promise.resolve("M\tvendored/sub"),
      treeEntryMode: () => Promise.resolve("160000"),
      showFile: ({ path }) => {
        shown.set(shown.size, path);
        return Promise.resolve("");
      },
    });
    const context = await collectWith(git);
    expect([context.changedFiles[0]?.omissionReason, shown.size]).toStrictEqual(["submodule", 0]);
  });

  test("1,000,000 バイト超は理由 too-large になる", async () => {
    const git = gitWith({
      nameStatusDiff: () => Promise.resolve("M\tbig.ts"),
      showFile: () => Promise.resolve("x".repeat(1_000_001)),
    });
    const context = await collectWith(git);
    expect([
      context.changedFiles[0]?.omissionReason,
      context.changedFiles[0]?.content,
    ]).toStrictEqual(["too-large", null]);
  });

  test("閾値以下は本文を保持する", async () => {
    const git = gitWith({
      nameStatusDiff: () => Promise.resolve("M\tsmall.ts"),
      showFile: () => Promise.resolve("hello"),
    });
    const context = await collectWith(git);
    expect([
      context.changedFiles[0]?.content,
      context.changedFiles[0]?.omissionReason,
    ]).toStrictEqual(["hello", null]);
  });

  test("統合 diff と PR 番号をそのまま持つ", async () => {
    const context = await collectWith(gitWith({}));
    expect([context.diff, context.prNumber]).toStrictEqual(["diff text", 7]);
  });

  test("name-status 取得の失敗はそのまま伝播する", async () => {
    const git = gitWith({ nameStatusDiff: () => Promise.reject(new Error("git blew up")) });
    await expect(collectWith(git)).rejects.toThrow("git blew up");
  });
});
