import { describe, expect, test } from "vite-plus/test";

import { isProtectedBranch, UNKNOWN_BRANCH_MARKER } from "./protected-branch.ts";

describe("isProtectedBranch", () => {
  test("デフォルトブランチの解決に失敗したら全ブランチを保護する", () => {
    expect(isProtectedBranch({ branch: "topic/x", defaultBranch: null })).toStrictEqual(true);
  });

  test("ブランチが存在しない worktree は保護せず削除可能側に倒す", () => {
    expect(isProtectedBranch({ branch: null, defaultBranch: "main" })).toStrictEqual(false);
  });

  test("ブランチ不明マーカーは保護する", () => {
    expect(
      isProtectedBranch({ branch: UNKNOWN_BRANCH_MARKER, defaultBranch: "main" }),
    ).toStrictEqual(true);
  });

  test("デフォルトブランチと一致するブランチは保護する", () => {
    expect(isProtectedBranch({ branch: "develop", defaultBranch: "develop" })).toStrictEqual(true);
  });

  test("main と master は常に保護する", () => {
    expect([
      isProtectedBranch({ branch: "main", defaultBranch: "develop" }),
      isProtectedBranch({ branch: "master", defaultBranch: "develop" }),
    ]).toStrictEqual([true, true]);
  });

  test("保護対象でない作業ブランチは削除可能", () => {
    expect(isProtectedBranch({ branch: "topic/x", defaultBranch: "main" })).toStrictEqual(false);
  });
});
