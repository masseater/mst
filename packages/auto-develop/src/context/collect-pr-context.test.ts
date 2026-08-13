import { describe, expect, test, vi } from "vite-plus/test";

import { collectPrContext, type PrContextGit } from "./collect-pr-context.ts";

describe("collectPrContext", () => {
  const it = test
    .extend("deletedFileContext", () =>
      collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("D\tsrc/gone.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: () => Promise.resolve("file content"),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      }))
    .extend("showFileSpyForDeletion", async () => {
      const showFileSpy = vi.fn<PrContextGit["showFile"]>(() => Promise.resolve("file content"));
      await collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("D\tsrc/gone.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: showFileSpy,
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      });
      return showFileSpy;
    })
    .extend("submoduleContext", () =>
      collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tvendored/sub"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("160000"),
          showFile: () => Promise.resolve("file content"),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      }),
    )
    .extend("showFileSpyForSubmodule", async () => {
      const showFileSpy = vi.fn<PrContextGit["showFile"]>(() => Promise.resolve("file content"));
      await collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tvendored/sub"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("160000"),
          showFile: showFileSpy,
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      });
      return showFileSpy;
    })
    .extend("oversizedFileContext", () =>
      collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tbig.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: () => Promise.resolve("x".repeat(1_000_001)),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      }),
    )
    .extend("showFileSpyForOversizedFile", async () => {
      const showFileSpy = vi.fn<PrContextGit["showFile"]>(() =>
        Promise.resolve("x".repeat(1_000_001)),
      );
      await collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tbig.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: showFileSpy,
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      });
      return showFileSpy;
    })
    .extend("smallFileContext", () =>
      collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tsmall.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: () => Promise.resolve("hello"),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      }),
    )
    .extend("showFileSpyForSmallFile", async () => {
      const showFileSpy = vi.fn<PrContextGit["showFile"]>(() => Promise.resolve("hello"));
      await collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve("M\tsmall.ts"),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: showFileSpy,
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      });
      return showFileSpy;
    })
    .extend("emptyDiffContext", () =>
      collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve(""),
          unifiedDiff: () => Promise.resolve("diff text"),
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: () => Promise.resolve("file content"),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      }),
    )
    .extend("unifiedDiffSpyForEmptyDiff", async () => {
      const unifiedDiffSpy = vi.fn<PrContextGit["unifiedDiff"]>(() => Promise.resolve("diff text"));
      await collectPrContext({
        git: {
          nameStatusDiff: () => Promise.resolve(""),
          unifiedDiff: unifiedDiffSpy,
          treeEntryMode: () => Promise.resolve("100644"),
          showFile: () => Promise.resolve("file content"),
        },
        github: {
          commentContext: () =>
            Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
          ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
        },
        prNumber: 7,
        base: "main",
        head: "topic/x",
        failedLogsDir: "/logs",
      });
      return unifiedDiffSpy;
    })
    .extend("nameStatusFailure", async () => {
      try {
        return await collectPrContext({
          git: {
            nameStatusDiff: () => Promise.reject(new Error("git blew up")),
            unifiedDiff: () => Promise.resolve("diff text"),
            treeEntryMode: () => Promise.resolve("100644"),
            showFile: () => Promise.resolve("file content"),
          },
          github: {
            commentContext: () =>
              Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
            ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
          },
          prNumber: 7,
          base: "main",
          head: "topic/x",
          failedLogsDir: "/logs",
        });
      } catch (thrown) {
        return thrown;
      }
    });

  it("削除ファイルは理由 deleted になり本文を持たない", ({ deletedFileContext }) => {
    expect(deletedFileContext).toStrictEqual({
      prNumber: 7,
      base: "main",
      head: "topic/x",
      diff: "diff text",
      changedFiles: [
        {
          statusCode: "D",
          path: "src/gone.ts",
          previousPath: null,
          content: null,
          omissionReason: "deleted",
        },
      ],
      comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
      ci: { checks: [], failedLogPaths: [] },
    });
  });

  it("削除ファイルは git show を呼ばない", ({ showFileSpyForDeletion }) => {
    expect(showFileSpyForDeletion).not.toHaveBeenCalled();
  });

  it("gitlink モードは理由 submodule になり本文を持たない", ({ submoduleContext }) => {
    expect(submoduleContext).toStrictEqual({
      prNumber: 7,
      base: "main",
      head: "topic/x",
      diff: "diff text",
      changedFiles: [
        {
          statusCode: "M",
          path: "vendored/sub",
          previousPath: null,
          content: null,
          omissionReason: "submodule",
        },
      ],
      comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
      ci: { checks: [], failedLogPaths: [] },
    });
  });

  it("gitlink モードは git show を呼ばない", ({ showFileSpyForSubmodule }) => {
    expect(showFileSpyForSubmodule).not.toHaveBeenCalled();
  });

  it("1,000,000 バイト超は理由 too-large になり本文を持たない", ({ oversizedFileContext }) => {
    expect(oversizedFileContext).toStrictEqual({
      prNumber: 7,
      base: "main",
      head: "topic/x",
      diff: "diff text",
      changedFiles: [
        {
          statusCode: "M",
          path: "big.ts",
          previousPath: null,
          content: null,
          omissionReason: "too-large",
        },
      ],
      comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
      ci: { checks: [], failedLogPaths: [] },
    });
  });

  it("1,000,000 バイト超でも本文は head から取得される", ({ showFileSpyForOversizedFile }) => {
    expect(showFileSpyForOversizedFile).toHaveBeenCalledWith({ ref: "topic/x", path: "big.ts" });
  });

  it("閾値以下は本文を保持し省略理由を持たない", ({ smallFileContext }) => {
    expect(smallFileContext).toStrictEqual({
      prNumber: 7,
      base: "main",
      head: "topic/x",
      diff: "diff text",
      changedFiles: [
        {
          statusCode: "M",
          path: "small.ts",
          previousPath: null,
          content: "hello",
          omissionReason: null,
        },
      ],
      comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
      ci: { checks: [], failedLogPaths: [] },
    });
  });

  it("閾値以下の本文は head から取得される", ({ showFileSpyForSmallFile }) => {
    expect(showFileSpyForSmallFile).toHaveBeenCalledWith({ ref: "topic/x", path: "small.ts" });
  });

  it("変更が無ければ統合 diff と PR 番号だけを持つ", ({ emptyDiffContext }) => {
    expect(emptyDiffContext).toStrictEqual({
      prNumber: 7,
      base: "main",
      head: "topic/x",
      diff: "diff text",
      changedFiles: [],
      comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
      ci: { checks: [], failedLogPaths: [] },
    });
  });

  it("統合 diff は base と head の組で取得される", ({ unifiedDiffSpyForEmptyDiff }) => {
    expect(unifiedDiffSpyForEmptyDiff).toHaveBeenCalledWith({ base: "main", head: "topic/x" });
  });

  it("name-status 取得の失敗はそのまま伝播する", ({ nameStatusFailure }) => {
    expect(nameStatusFailure).toStrictEqual(new Error("git blew up"));
  });
});
