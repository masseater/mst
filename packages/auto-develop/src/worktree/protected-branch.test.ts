import { describe, expect, test } from "vite-plus/test";

import { isProtectedBranch, UNKNOWN_BRANCH_MARKER } from "./protected-branch.ts";

const it = test
  .extend("protectionWithoutDefaultBranch", () =>
    isProtectedBranch({ branch: "topic/x", defaultBranch: null }))
  .extend("protectionForBranchlessWorktree", () =>
    isProtectedBranch({ branch: null, defaultBranch: "main" }),
  )
  .extend("protectionForUnknownMarker", () =>
    isProtectedBranch({ branch: UNKNOWN_BRANCH_MARKER, defaultBranch: "main" }),
  )
  .extend("protectionForDefaultBranch", () =>
    isProtectedBranch({ branch: "develop", defaultBranch: "develop" }),
  )
  .extend("protectionForMain", () =>
    isProtectedBranch({ branch: "main", defaultBranch: "develop" }),
  )
  .extend("protectionForMaster", () =>
    isProtectedBranch({ branch: "master", defaultBranch: "develop" }),
  )
  .extend("protectionForTopicBranch", () =>
    isProtectedBranch({ branch: "topic/x", defaultBranch: "main" }),
  );

describe("isProtectedBranch", () => {
  it("デフォルトブランチの解決に失敗したら全ブランチを保護する", ({
    protectionWithoutDefaultBranch,
  }) => {
    expect(protectionWithoutDefaultBranch).toStrictEqual(true);
  });

  it("ブランチが存在しない worktree は保護せず削除可能側に倒す", ({
    protectionForBranchlessWorktree,
  }) => {
    expect(protectionForBranchlessWorktree).toStrictEqual(false);
  });

  it("ブランチ不明マーカーは保護する", ({ protectionForUnknownMarker }) => {
    expect(protectionForUnknownMarker).toStrictEqual(true);
  });

  it("デフォルトブランチと一致するブランチは保護する", ({ protectionForDefaultBranch }) => {
    expect(protectionForDefaultBranch).toStrictEqual(true);
  });

  it("main は常に保護する", ({ protectionForMain }) => {
    expect(protectionForMain).toStrictEqual(true);
  });

  it("master は常に保護する", ({ protectionForMaster }) => {
    expect(protectionForMaster).toStrictEqual(true);
  });

  it("保護対象でない作業ブランチは削除可能", ({ protectionForTopicBranch }) => {
    expect(protectionForTopicBranch).toStrictEqual(false);
  });
});
