import { describe, expect, test } from "vite-plus/test";

import { collectPrContext, type PrContextGit, type PrContextGithub } from "./collect-pr-context.ts";

import type { PrContext } from "./pr-context.ts";

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

const collectWith = (git: PrContextGit): Promise<PrContext> =>
  collectPrContext({
    git,
    github: emptyGithub,
    prNumber: 7,
    base: "main",
    head: "topic/x",
    failedLogsDir: "/logs",
  });

const collectTrackingShow = async (
  overrides: Partial<PrContextGit>,
): Promise<{ readonly context: PrContext; readonly shownCount: number }> => {
  const shownPaths = new Map<number, string>();
  const git = gitWith(overrides);
  const carried = await collectWith({
    ...git,
    showFile: (listed) => {
      shownPaths.set(shownPaths.size, listed.path);
      return git.showFile(listed);
    },
  });
  return { context: carried, shownCount: shownPaths.size };
};

const it = test
  .extend("deletedFileCollection", () =>
    collectTrackingShow({ nameStatusDiff: () => Promise.resolve("D\tsrc/gone.ts") }))
  .extend("submoduleCollection", () =>
    collectTrackingShow({
      nameStatusDiff: () => Promise.resolve("M\tvendored/sub"),
      treeEntryMode: () => Promise.resolve("160000"),
    }),
  )
  .extend("oversizedFile", async () => {
    const carried = await collectWith(
      gitWith({
        nameStatusDiff: () => Promise.resolve("M\tbig.ts"),
        showFile: () => Promise.resolve("x".repeat(1_000_001)),
      }),
    );
    return carried.changedFiles[0];
  })
  .extend("smallFile", async () => {
    const carried = await collectWith(
      gitWith({
        nameStatusDiff: () => Promise.resolve("M\tsmall.ts"),
        showFile: () => Promise.resolve("hello"),
      }),
    );
    return carried.changedFiles[0];
  })
  .extend("emptyDiffCollection", () => collectWith(gitWith({})));

describe("collectPrContext", () => {
  it("削除ファイルは理由 deleted になる", ({ deletedFileCollection }) => {
    expect(deletedFileCollection.context.changedFiles[0]?.omissionReason).toStrictEqual("deleted");
  });

  it("削除ファイルは git show を呼ばない", ({ deletedFileCollection }) => {
    expect(deletedFileCollection.shownCount).toStrictEqual(0);
  });

  it("gitlink モードは理由 submodule になる", ({ submoduleCollection }) => {
    expect(submoduleCollection.context.changedFiles[0]?.omissionReason).toStrictEqual("submodule");
  });

  it("gitlink モードは git show を呼ばない", ({ submoduleCollection }) => {
    expect(submoduleCollection.shownCount).toStrictEqual(0);
  });

  it("1,000,000 バイト超は理由 too-large になる", ({ oversizedFile }) => {
    expect(oversizedFile?.omissionReason).toStrictEqual("too-large");
  });

  it("1,000,000 バイト超は本文を持たない", ({ oversizedFile }) => {
    expect(oversizedFile?.content).toStrictEqual(null);
  });

  it("閾値以下は本文を保持する", ({ smallFile }) => {
    expect(smallFile?.content).toStrictEqual("hello");
  });

  it("閾値以下は省略理由を持たない", ({ smallFile }) => {
    expect(smallFile?.omissionReason).toStrictEqual(null);
  });

  it("統合 diff をそのまま持つ", ({ emptyDiffCollection }) => {
    expect(emptyDiffCollection.diff).toStrictEqual("diff text");
  });

  it("PR 番号をそのまま持つ", ({ emptyDiffCollection }) => {
    expect(emptyDiffCollection.prNumber).toStrictEqual(7);
  });

  it("name-status 取得の失敗はそのまま伝播する", async () => {
    const collecting = collectWith(
      gitWith({ nameStatusDiff: () => Promise.reject(new Error("git blew up")) }),
    );
    await expect(collecting).rejects.toThrow("git blew up");
  });
});
