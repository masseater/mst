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
  const it = test
    .extend("headingMarkdown", () => renderMarkdown(baseContext))
    .extend("prNumberMarkdown", () => renderMarkdown({ ...baseContext, prNumber: 42 }))
    .extend("baseBranchMarkdown", () => renderMarkdown({ ...baseContext, base: "release/9" }))
    .extend("headBranchMarkdown", () => renderMarkdown({ ...baseContext, head: "topic/rename" }))
    .extend("includedContentMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        changedFiles: [
          { statusCode: "M", path: "a.ts", previousPath: null, content: "x", omissionReason: null },
        ],
      }),
    )
    .extend("omittedWithReasonMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        changedFiles: [
          {
            statusCode: "D",
            path: "b.ts",
            previousPath: null,
            content: null,
            omissionReason: "deleted",
          },
        ],
      }),
    )
    .extend("omittedWithoutReasonMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        changedFiles: [
          {
            statusCode: "A",
            path: "c.ts",
            previousPath: null,
            content: null,
            omissionReason: null,
          },
        ],
      }),
    )
    .extend("unresolvedThreadMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        comments: {
          reviews: [],
          prComments: [],
          inlineComments: [],
          threads: [
            { id: "1", resolved: false, outdated: false, path: "a", line: 1, comments: [] },
            { id: "2", resolved: true, outdated: false, path: "b", line: 2, comments: [] },
          ],
        },
      }),
    )
    .extend("outdatedThreadMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        comments: {
          reviews: [],
          prComments: [],
          inlineComments: [],
          threads: [
            { id: "1", resolved: true, outdated: true, path: "a", line: 1, comments: [] },
            { id: "2", resolved: true, outdated: false, path: "b", line: 2, comments: [] },
          ],
        },
      }),
    )
    .extend("outdatedUnresolvedThreadMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        comments: {
          reviews: [],
          prComments: [],
          inlineComments: [],
          threads: [{ id: "1", resolved: false, outdated: true, path: "a", line: 1, comments: [] }],
        },
      }),
    )
    .extend("missingDetailsUrlMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        ci: {
          checks: [
            {
              name: "build",
              state: "failure",
              bucket: "fail",
              detailsUrl: null,
              workflowName: "ci",
            },
          ],
          failedLogPaths: [],
        },
      }),
    )
    .extend("withoutFailedLogMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        ci: {
          checks: [
            {
              name: "lint",
              state: "failure",
              bucket: "fail",
              detailsUrl: null,
              workflowName: "ci",
            },
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
    .extend("singleFailedLogMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        ci: { checks: [], failedLogPaths: ["ci-logs/build.log"] },
      }),
    )
    .extend("twoFailedLogsMarkdown", () =>
      renderMarkdown({
        ...baseContext,
        ci: { checks: [], failedLogPaths: ["ci-logs/build.log", "ci-logs/test.log"] },
      }),
    );

  it("見出しから始まる", ({ headingMarkdown }) => {
    expect(headingMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("PR 節は PR 番号を持つ", ({ prNumberMarkdown }) => {
    expect(prNumberMarkdown).toBe(`# PR Context

## Pull Request

- PR: #42
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("PR 節は base を持つ", ({ baseBranchMarkdown }) => {
    expect(baseBranchMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: release/9
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("PR 節は head を持つ", ({ headBranchMarkdown }) => {
    expect(headBranchMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/rename

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("本文ありは included になる", ({ includedContentMarkdown }) => {
    expect(includedContentMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |
| M | a.ts | included |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("省略は理由付きになる", ({ omittedWithReasonMarkdown }) => {
    expect(omittedWithReasonMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |
| D | b.ts | omitted: deleted |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("理由なしの省略は not available になる", ({ omittedWithoutReasonMarkdown }) => {
    expect(omittedWithoutReasonMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |
| A | c.ts | omitted: not available |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("スレッド集計は未解決を数える", ({ unresolvedThreadMarkdown }) => {
    expect(unresolvedThreadMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 2
- Unresolved threads: 1
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("スレッド集計は outdated を数える", ({ outdatedThreadMarkdown }) => {
    expect(outdatedThreadMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 2
- Unresolved threads: 0
- Outdated threads: 1
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("スレッド集計は outdated かつ未解決を別に数える", ({ outdatedUnresolvedThreadMarkdown }) => {
    expect(outdatedUnresolvedThreadMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 1
- Unresolved threads: 1
- Outdated threads: 1
- Outdated and unresolved threads: 1

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("CI 詳細リンク欠損は空セルになる", ({ missingDetailsUrlMarkdown }) => {
    expect(missingDetailsUrlMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |
| build | failure | fail |  |

No failed CI logs were downloaded.`);
  });

  it("失敗ログ 0 件は 1 文になる", ({ withoutFailedLogMarkdown }) => {
    expect(withoutFailedLogMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |
| lint | failure | fail |  |

No failed CI logs were downloaded.`);
  });

  it("パイプと改行はエスケープされる", ({ escapedPathMarkdown }) => {
    expect(escapedPathMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |
| M | a\\|b<br>c.ts | included |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

No failed CI logs were downloaded.`);
  });

  it("CI 詳細リンクがあればセルに入る", ({ linkedCheckMarkdown }) => {
    expect(linkedCheckMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |
| build | success | pass | https://ci.example/build |

No failed CI logs were downloaded.`);
  });

  it("失敗ログがあれば見出しが付く", ({ singleFailedLogMarkdown }) => {
    expect(singleFailedLogMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

Failed CI logs:

- ci-logs/build.log`);
  });

  it("失敗ログがあれば一覧で並ぶ", ({ twoFailedLogsMarkdown }) => {
    expect(twoFailedLogsMarkdown).toBe(`# PR Context

## Pull Request

- PR: #7
- Base: main
- Head: topic/x

## Changed Files

| Status | Path | Content |
| --- | --- | --- |

## Existing Comments

- Reviews: 0
- PR-level comments: 0
- Inline comments: 0
- Threads: 0
- Unresolved threads: 0
- Outdated threads: 0
- Outdated and unresolved threads: 0

## CI

| Name | State | Bucket | Details |
| --- | --- | --- | --- |

Failed CI logs:

- ci-logs/build.log
- ci-logs/test.log`);
  });
});
