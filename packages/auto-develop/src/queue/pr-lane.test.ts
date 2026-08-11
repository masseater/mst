import { describe, expect, test } from "vite-plus/test";

import { laneAdmitted, prLaneNumber, prLaneOf } from "./pr-lane.ts";

describe("prLaneNumber", () => {
  test("pr- に続く先頭ゼロなしの正整数だけを PR レーンとみなす", () => {
    expect([
      prLaneNumber("pr-7"),
      prLaneNumber("pr-0"),
      prLaneNumber("pr-07"),
      prLaneNumber("system-maintenance"),
    ]).toStrictEqual([7, null, null, null]);
  });

  test("PR 番号からレーン名を導出できる", () => {
    expect(prLaneOf(7)).toStrictEqual("pr-7");
  });
});

describe("laneAdmitted", () => {
  const prFilter = { targetPrs: [7], excludedPrs: [8] };

  test("包含リストに載る PR レーンは通る", () => {
    expect(laneAdmitted({ lane: "pr-7", prFilter })).toStrictEqual(true);
  });

  test("除外リストの PR レーンは通らない", () => {
    expect(laneAdmitted({ lane: "pr-8", prFilter })).toStrictEqual(false);
  });

  test("包含と除外の両方に載る PR は除外が勝つ", () => {
    expect(
      laneAdmitted({ lane: "pr-7", prFilter: { targetPrs: [7], excludedPrs: [7] } }),
    ).toStrictEqual(false);
  });

  test("包含リストが空でないなら載っていない PR は通らない", () => {
    expect(laneAdmitted({ lane: "pr-9", prFilter })).toStrictEqual(false);
  });

  test("包含リストが空なら除外以外のすべての PR が通る", () => {
    expect(
      laneAdmitted({ lane: "pr-9", prFilter: { targetPrs: [], excludedPrs: [8] } }),
    ).toStrictEqual(true);
  });

  test("PR レーン文法に合わないレーンはフィルタ対象外で常に通る", () => {
    expect(laneAdmitted({ lane: "system-maintenance", prFilter })).toStrictEqual(true);
  });

  test("フィルタ未設定なら常に通る", () => {
    expect(laneAdmitted({ lane: "pr-9", prFilter: undefined })).toStrictEqual(true);
  });
});
