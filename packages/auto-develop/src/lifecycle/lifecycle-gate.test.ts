import { describe, expect, test } from "vite-plus/test";

import { createLifecycleGate } from "./lifecycle-gate.ts";
import { PrClosedError } from "./pr-closed-error.ts";
import { PrExcludedError } from "./pr-excluded-error.ts";
import { ReviewInputChangedError } from "./review-input-changed-error.ts";

describe("createLifecycleGate のシグナル", () => {
  const it = test
    .extend("reopenedSignalWhileOpen", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      return gate.openSignal(7) === openedSignal;
    })
    .extend("reopenedSignalAfterInterrupt", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.interruptForInputChange(7);
      return gate.openSignal(7) === openedSignal;
    })
    .extend("signalReusedAfterInterrupt", () => {
      const gate = createLifecycleGate();
      gate.openSignal(7);
      gate.interruptForInputChange(7);
      const signalOpenedAfterInterrupt = gate.openSignal(7);
      return gate.openSignal(7) === signalOpenedAfterInterrupt;
    })
    .extend("interruptAbortReason", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.interruptForInputChange(7);
      try {
        openedSignal.throwIfAborted();
      } catch (abortReason) {
        return abortReason;
      }
      throw new Error("入力変更の中断が開いていたシグナルを止めなかった");
    });

  it("未 abort のシグナルがあれば同じものを返す", ({ reopenedSignalWhileOpen }) => {
    expect(reopenedSignalWhileOpen).toBe(true);
  });

  it("中断されたシグナルは開き直しの対象から外れる", ({ reopenedSignalAfterInterrupt }) => {
    expect(reopenedSignalAfterInterrupt).toBe(false);
  });

  it("中断のあとの open は開き直しに耐える新しいシグナルを返す", ({
    signalReusedAfterInterrupt,
  }) => {
    expect(signalReusedAfterInterrupt).toBe(true);
  });

  it("入力変更中断の理由は入力変更になる", ({ interruptAbortReason }) => {
    expect(interruptAbortReason).toStrictEqual(new ReviewInputChangedError(7));
  });
});

describe("createLifecycleGate のクローズと除外", () => {
  const it = test
    .extend("closedFlagAfterClose", () => {
      const gate = createLifecycleGate();
      gate.openSignal(7);
      gate.close(7);
      return gate.isClosed(7);
    })
    .extend("closeAbortReason", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.close(7);
      try {
        openedSignal.throwIfAborted();
      } catch (abortReason) {
        return abortReason;
      }
      throw new Error("クローズが開いていたシグナルを止めなかった");
    })
    .extend("reopenedSignalAfterClose", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.close(7);
      return gate.openSignal(7) === openedSignal;
    })
    .extend("closedFlagAfterExclude", () => {
      const gate = createLifecycleGate();
      gate.openSignal(7);
      gate.excludeSession(7);
      return gate.isClosed(7);
    })
    .extend("excludeAbortReason", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.excludeSession(7);
      try {
        openedSignal.throwIfAborted();
      } catch (abortReason) {
        return abortReason;
      }
      throw new Error("除外が開いていたシグナルを止めなかった");
    })
    .extend("reopenedSignalAfterExclude", () => {
      const gate = createLifecycleGate();
      const openedSignal = gate.openSignal(7);
      gate.excludeSession(7);
      return gate.openSignal(7) === openedSignal;
    })
    .extend("closedFlagForPrWithoutSignal", () => {
      const gate = createLifecycleGate();
      gate.close(9);
      return gate.isClosed(9);
    });

  it("close はクローズ集合へ記録する", ({ closedFlagAfterClose }) => {
    expect(closedFlagAfterClose).toBe(true);
  });

  it("close の中断理由は PR クローズになる", ({ closeAbortReason }) => {
    expect(closeAbortReason).toStrictEqual(new PrClosedError(7));
  });

  it("close は進行中のシグナルを開き直しの対象から外す", ({ reopenedSignalAfterClose }) => {
    expect(reopenedSignalAfterClose).toBe(false);
  });

  it("除外はクローズ扱いにしない", ({ closedFlagAfterExclude }) => {
    expect(closedFlagAfterExclude).toBe(false);
  });

  it("除外の中断理由は PR 除外になる", ({ excludeAbortReason }) => {
    expect(excludeAbortReason).toStrictEqual(new PrExcludedError(7));
  });

  it("除外も進行中のシグナルを開き直しの対象から外す", ({ reopenedSignalAfterExclude }) => {
    expect(reopenedSignalAfterExclude).toBe(false);
  });

  it("シグナル未作成の PR への close も記録される", ({ closedFlagForPrWithoutSignal }) => {
    expect(closedFlagForPrWithoutSignal).toBe(true);
  });
});

describe("createLifecycleGate の世代", () => {
  const it = test
    .extend("generationAfterInterrupt", () => {
      const gate = createLifecycleGate();
      gate.interruptForInputChange(7);
      return gate.generationOf(7);
    })
    .extend("generationWithoutRecord", () => {
      const gate = createLifecycleGate();
      return gate.generationOf(7);
    })
    .extend("currentGenerationVerdictForZero", () => {
      const gate = createLifecycleGate();
      return gate.isCurrentGeneration({ prNumber: 7, generation: 0 });
    })
    .extend("currentGenerationVerdictForOne", () => {
      const gate = createLifecycleGate();
      return gate.isCurrentGeneration({ prNumber: 7, generation: 1 });
    });

  it("入力変更中断は世代を 1 進める", ({ generationAfterInterrupt }) => {
    expect(generationAfterInterrupt).toBe(1);
  });

  it("記録の無い PR の世代は 0 から始まる", ({ generationWithoutRecord }) => {
    expect(generationWithoutRecord).toBe(0);
  });

  it("同じ世代番号は現在世代として一致する", ({ currentGenerationVerdictForZero }) => {
    expect(currentGenerationVerdictForZero).toBe(true);
  });

  it("違う世代番号は現在世代と一致しない", ({ currentGenerationVerdictForOne }) => {
    expect(currentGenerationVerdictForOne).toBe(false);
  });
});
