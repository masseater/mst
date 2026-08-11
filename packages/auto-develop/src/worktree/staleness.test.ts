import { describe, expect, test } from "vite-plus/test";

import { remoteBranchPresentIn, shouldReclaim, STALE_AFTER_MS } from "./staleness.ts";

describe("shouldReclaim", () => {
  test("リモート存在確認に失敗したら保守側で回収しない", () => {
    expect(
      shouldReclaim({ remoteBranchExists: null, lastUsedMtimeMs: 0, nowMs: STALE_AFTER_MS * 10 }),
    ).toStrictEqual(false);
  });

  test("リモートブランチが消滅していれば無条件で回収する", () => {
    expect(
      shouldReclaim({ remoteBranchExists: false, lastUsedMtimeMs: Date.now(), nowMs: Date.now() }),
    ).toStrictEqual(true);
  });

  test("マーカー mtime が読めなければ回収しない", () => {
    expect(
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: null, nowMs: Date.now() }),
    ).toStrictEqual(false);
  });

  test("最終使用から 3 日ちょうどで回収する", () => {
    expect(
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: 0, nowMs: STALE_AFTER_MS }),
    ).toStrictEqual(true);
  });

  test("3 日以内なら保持する", () => {
    expect(
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: 0, nowMs: STALE_AFTER_MS - 1 }),
    ).toStrictEqual(false);
  });
});

describe("remoteBranchPresentIn", () => {
  test("タブ区切りの完全修飾 ref の末尾一致で存在を判定する", () => {
    const output = "abc123\trefs/heads/feature/x\n";
    expect(remoteBranchPresentIn(output, "feature/x")).toStrictEqual(true);
  });

  test("前方一致だけの行は消滅とみなす", () => {
    const output = "abc123\trefs/heads/feature/x-extra\n";
    expect(remoteBranchPresentIn(output, "feature/x")).toStrictEqual(false);
  });

  test("空の出力は消滅とみなす", () => {
    expect(remoteBranchPresentIn("", "feature/x")).toStrictEqual(false);
  });
});
