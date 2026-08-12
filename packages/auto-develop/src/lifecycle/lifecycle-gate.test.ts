import { describe, expect, test } from "vite-plus/test";

import { createLifecycleGate } from "./lifecycle-gate.ts";
import { PrClosedError } from "./pr-closed-error.ts";
import { ReviewInputChangedError } from "./review-input-changed-error.ts";

const it = test
  .extend("signalsForSamePr", () => {
    const gate = createLifecycleGate();
    return { first: gate.openSignal(7), second: gate.openSignal(7) };
  })
  .extend("signalsAcrossInterrupt", () => {
    const gate = createLifecycleGate();
    const before = gate.openSignal(7);
    gate.interruptForInputChange(7);
    return { before, after: gate.openSignal(7) };
  })
  .extend("closedGate", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.close(7);
    return {
      closed: gate.isClosed(7),
      aborted: signal.aborted,
      reason: signal.reason as unknown,
    };
  })
  .extend("excludedGate", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.excludeSession(7);
    return { closed: gate.isClosed(7), aborted: signal.aborted };
  })
  .extend("interruptedGate", () => {
    const gate = createLifecycleGate();
    const signal = gate.openSignal(7);
    gate.interruptForInputChange(7);
    return {
      generation: gate.generationOf(7),
      aborted: signal.aborted,
      reason: signal.reason as unknown,
    };
  })
  .extend("freshGeneration", () => {
    const gate = createLifecycleGate();
    return {
      generation: gate.generationOf(7),
      matchesZero: gate.isCurrentGeneration({ prNumber: 7, generation: 0 }),
      matchesOne: gate.isCurrentGeneration({ prNumber: 7, generation: 1 }),
    };
  })
  .extend("closedWithoutSignal", () => {
    const gate = createLifecycleGate();
    gate.close(9);
    return gate.isClosed(9);
  });

describe("createLifecycleGate のシグナル", () => {
  it("未 abort のシグナルがあれば同じものを返す", ({ signalsForSamePr }) => {
    expect(signalsForSamePr.first).toStrictEqual(signalsForSamePr.second);
  });

  it("中断されたシグナルは abort 済みのまま残る", ({ signalsAcrossInterrupt }) => {
    expect(signalsAcrossInterrupt.before.aborted).toStrictEqual(true);
  });

  it("中断のあとの open は未 abort の新しいシグナルを返す", ({ signalsAcrossInterrupt }) => {
    expect(signalsAcrossInterrupt.after.aborted).toStrictEqual(false);
  });
});

describe("createLifecycleGate のクローズと除外", () => {
  it("close はクローズ集合へ記録する", ({ closedGate }) => {
    expect(closedGate.closed).toStrictEqual(true);
  });

  it("close は進行中のシグナルを止める", ({ closedGate }) => {
    expect(closedGate.aborted).toStrictEqual(true);
  });

  it("close の中断理由は PR クローズになる", ({ closedGate }) => {
    expect(closedGate.reason).toBeInstanceOf(PrClosedError);
  });

  it("除外はクローズ扱いにしない", ({ excludedGate }) => {
    expect(excludedGate.closed).toStrictEqual(false);
  });

  it("除外も進行中のシグナルは止める", ({ excludedGate }) => {
    expect(excludedGate.aborted).toStrictEqual(true);
  });

  it("シグナル未作成の PR への close も記録される", ({ closedWithoutSignal }) => {
    expect(closedWithoutSignal).toStrictEqual(true);
  });
});

describe("createLifecycleGate の世代", () => {
  it("入力変更中断は世代を 1 進める", ({ interruptedGate }) => {
    expect(interruptedGate.generation).toStrictEqual(1);
  });

  it("入力変更中断は進行中のシグナルを止める", ({ interruptedGate }) => {
    expect(interruptedGate.aborted).toStrictEqual(true);
  });

  it("入力変更中断の理由は入力変更になる", ({ interruptedGate }) => {
    expect(interruptedGate.reason).toBeInstanceOf(ReviewInputChangedError);
  });

  it("記録の無い PR の世代は 0 から始まる", ({ freshGeneration }) => {
    expect(freshGeneration.generation).toStrictEqual(0);
  });

  it("同じ世代番号は現在世代として一致する", ({ freshGeneration }) => {
    expect(freshGeneration.matchesZero).toStrictEqual(true);
  });

  it("違う世代番号は現在世代と一致しない", ({ freshGeneration }) => {
    expect(freshGeneration.matchesOne).toStrictEqual(false);
  });
});
