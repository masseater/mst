import { describe, expect, test } from "vite-plus/test";

import { remoteBranchPresentIn, shouldReclaim } from "./staleness.ts";

describe("shouldReclaim", () => {
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const it = test
    .extend("reclaimWithUnknownRemote", () =>
      shouldReclaim({ remoteBranchExists: null, lastUsedMtimeMs: 0, nowMs: threeDaysMs * 10 }))
    .extend("reclaimWithVanishedRemote", () =>
      shouldReclaim({ remoteBranchExists: false, lastUsedMtimeMs: Date.now(), nowMs: Date.now() }),
    )
    .extend("reclaimWithUnreadableMarker", () =>
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: null, nowMs: Date.now() }),
    )
    .extend("reclaimAtExactlyThreeDays", () =>
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: 0, nowMs: threeDaysMs }),
    )
    .extend("reclaimJustUnderThreeDays", () =>
      shouldReclaim({ remoteBranchExists: true, lastUsedMtimeMs: 0, nowMs: threeDaysMs - 1 }),
    );

  it("リモート存在確認に失敗したら保守側で回収しない", ({ reclaimWithUnknownRemote }) => {
    expect(reclaimWithUnknownRemote).toStrictEqual(false);
  });

  it("リモートブランチが消滅していれば無条件で回収する", ({ reclaimWithVanishedRemote }) => {
    expect(reclaimWithVanishedRemote).toStrictEqual(true);
  });

  it("マーカー mtime が読めなければ回収しない", ({ reclaimWithUnreadableMarker }) => {
    expect(reclaimWithUnreadableMarker).toStrictEqual(false);
  });

  it("最終使用から 3 日ちょうどで回収する", ({ reclaimAtExactlyThreeDays }) => {
    expect(reclaimAtExactlyThreeDays).toStrictEqual(true);
  });

  it("3 日以内なら保持する", ({ reclaimJustUnderThreeDays }) => {
    expect(reclaimJustUnderThreeDays).toStrictEqual(false);
  });
});

describe("remoteBranchPresentIn", () => {
  const it = test
    .extend("presenceForExactRef", () =>
      remoteBranchPresentIn("abc123\trefs/heads/feature/x\n", "feature/x"))
    .extend("presenceForPrefixOnlyRef", () =>
      remoteBranchPresentIn("abc123\trefs/heads/feature/x-extra\n", "feature/x"),
    )
    .extend("presenceForEmptyOutput", () => remoteBranchPresentIn("", "feature/x"));

  it("タブ区切りの完全修飾 ref の末尾一致で存在を判定する", ({ presenceForExactRef }) => {
    expect(presenceForExactRef).toStrictEqual(true);
  });

  it("前方一致だけの行は消滅とみなす", ({ presenceForPrefixOnlyRef }) => {
    expect(presenceForPrefixOnlyRef).toStrictEqual(false);
  });

  it("空の出力は消滅とみなす", ({ presenceForEmptyOutput }) => {
    expect(presenceForEmptyOutput).toStrictEqual(false);
  });
});
