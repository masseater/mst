import { describe, expect, test } from "vite-plus/test";

import { createLifecycleGate } from "./lifecycle-gate.ts";
import { PrClosedError } from "./pr-closed-error.ts";
import { ReviewInputChangedError } from "./review-input-changed-error.ts";

describe("createLifecycleGate", () => {
  test("未 abort のシグナルがあれば同じものを返す", () => {
    const gate = createLifecycleGate();
    expect(gate.openSignal(7)).toStrictEqual(gate.openSignal(7));
  });

  test("abort 済みなら次の open で新しいシグナルを開く", () => {
    const gate = createLifecycleGate();
    const first = gate.openSignal(7);
    gate.interruptForInputChange(7);
    const second = gate.openSignal(7);
    expect([first.aborted, second.aborted, first === second]).toStrictEqual([true, false, false]);
  });

  test("close はクローズ集合へ記録し PR クローズ理由で abort する", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.close(7);
    expect([
      gate.isClosed(7),
      signal.aborted,
      signal.reason instanceof PrClosedError,
    ]).toStrictEqual([true, true, true]);
  });

  test("除外はクローズ扱いにせず abort のみ", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.excludeSession(7);
    expect([gate.isClosed(7), signal.aborted]).toStrictEqual([false, true]);
  });

  test("入力変更中断は世代を 1 進め入力変更理由で abort するが再作成はしない", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.interruptForInputChange(7);
    expect([
      gate.generationOf(7),
      signal.aborted,
      signal.reason instanceof ReviewInputChangedError,
    ]).toStrictEqual([1, true, true]);
  });

  test("世代照会は記録なしで 0、等値で一致判定する", () => {
    const gate = createLifecycleGate();
    expect([
      gate.generationOf(7),
      gate.isCurrentGeneration({ prNumber: 7, generation: 0 }),
      gate.isCurrentGeneration({ prNumber: 7, generation: 1 }),
    ]).toStrictEqual([0, true, false]);
  });

  test("シグナル未作成の PR への close も例外なく記録される", () => {
    const gate = createLifecycleGate();
    gate.close(9);
    expect(gate.isClosed(9)).toStrictEqual(true);
  });
});
