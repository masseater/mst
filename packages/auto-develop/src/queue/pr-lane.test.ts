import { describe, expect, test } from "vite-plus/test";

import { laneAdmitted, prLaneNumber, prLaneOf } from "./pr-lane.ts";

const prFilter = { targetPrs: [7], excludedPrs: [8] };

const it = test
  .extend("plainPrLaneNumber", () => prLaneNumber("pr-7"))
  .extend("zeroPrLaneNumber", () => prLaneNumber("pr-0"))
  .extend("leadingZeroPrLaneNumber", () => prLaneNumber("pr-07"))
  .extend("nonPrLaneNumber", () => prLaneNumber("system-maintenance"))
  .extend("laneNameForSeven", () => prLaneOf(7))
  .extend("targetedLaneAdmission", () => laneAdmitted({ lane: "pr-7", prFilter }))
  .extend("excludedLaneAdmission", () => laneAdmitted({ lane: "pr-8", prFilter }))
  .extend("bothListedLaneAdmission", () =>
    laneAdmitted({ lane: "pr-7", prFilter: { targetPrs: [7], excludedPrs: [7] } }),
  )
  .extend("unlistedLaneAdmission", () => laneAdmitted({ lane: "pr-9", prFilter }))
  .extend("emptyTargetLaneAdmission", () =>
    laneAdmitted({ lane: "pr-9", prFilter: { targetPrs: [], excludedPrs: [8] } }),
  )
  .extend("nonPrLaneAdmission", () => laneAdmitted({ lane: "system-maintenance", prFilter }))
  .extend("unfilteredLaneAdmission", () => laneAdmitted({ lane: "pr-9", prFilter: undefined }));

describe("prLaneNumber", () => {
  it("pr- に続く正整数を PR レーンとみなす", ({ plainPrLaneNumber }) => {
    expect(plainPrLaneNumber).toStrictEqual(7);
  });

  it("pr-0 は PR レーンとみなさない", ({ zeroPrLaneNumber }) => {
    expect(zeroPrLaneNumber).toStrictEqual(null);
  });

  it("先頭ゼロ付きの番号は PR レーンとみなさない", ({ leadingZeroPrLaneNumber }) => {
    expect(leadingZeroPrLaneNumber).toStrictEqual(null);
  });

  it("pr- で始まらないレーンは PR レーンとみなさない", ({ nonPrLaneNumber }) => {
    expect(nonPrLaneNumber).toStrictEqual(null);
  });

  it("PR 番号からレーン名を導出できる", ({ laneNameForSeven }) => {
    expect(laneNameForSeven).toStrictEqual("pr-7");
  });
});

describe("laneAdmitted", () => {
  it("包含リストに載る PR レーンは通る", ({ targetedLaneAdmission }) => {
    expect(targetedLaneAdmission).toStrictEqual(true);
  });

  it("除外リストの PR レーンは通らない", ({ excludedLaneAdmission }) => {
    expect(excludedLaneAdmission).toStrictEqual(false);
  });

  it("包含と除外の両方に載る PR は除外が勝つ", ({ bothListedLaneAdmission }) => {
    expect(bothListedLaneAdmission).toStrictEqual(false);
  });

  it("包含リストが空でないなら載っていない PR は通らない", ({ unlistedLaneAdmission }) => {
    expect(unlistedLaneAdmission).toStrictEqual(false);
  });

  it("包含リストが空なら除外以外のすべての PR が通る", ({ emptyTargetLaneAdmission }) => {
    expect(emptyTargetLaneAdmission).toStrictEqual(true);
  });

  it("PR レーン文法に合わないレーンはフィルタ対象外で常に通る", ({ nonPrLaneAdmission }) => {
    expect(nonPrLaneAdmission).toStrictEqual(true);
  });

  it("フィルタ未設定なら常に通る", ({ unfilteredLaneAdmission }) => {
    expect(unfilteredLaneAdmission).toStrictEqual(true);
  });
});
