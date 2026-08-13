import { describe, expect, test, vi } from "vite-plus/test";

import { createSerialGate } from "./serial-gate.ts";

describe("createSerialGate", () => {
  const it = test
    .extend("fifoCompletions", () => {
      const gate = createSerialGate();
      const slowRun = gate.run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return "first";
      });
      const quickRun = gate.run(() => Promise.resolve("second"));
      return Promise.all([slowRun, quickRun]);
    })
    .extend("failedSettlements", () => {
      const gate = createSerialGate();
      return Promise.allSettled([gate.run(() => Promise.reject(new Error("first broke")))]);
    })
    .extend("settlementsAfterFailure", () => {
      const gate = createSerialGate();
      const failingRun = gate.run(() => Promise.reject(new Error("first broke")));
      const followingRun = gate.run(() => Promise.resolve("done"));
      return Promise.allSettled([failingRun, followingRun]);
    })
    .extend("nextTask", async () => {
      const gate = createSerialGate();
      const nextTask = vi.fn<() => Promise<string>>(() => Promise.resolve("done"));
      await Promise.allSettled([
        gate.run(() => Promise.reject(new Error("first broke"))),
        gate.run(nextTask),
      ]);
      return nextTask;
    })
    .extend("firstCompletion", () => {
      const gate = createSerialGate();
      return gate.run(() => Promise.resolve("first"));
    })
    .extend("secondCompletion", async () => {
      const gate = createSerialGate();
      await gate.run(() => Promise.resolve("first"));
      return gate.run(() => Promise.resolve("second"));
    });

  it("処理を FIFO で 1 件ずつ流す", ({ fifoCompletions }) => {
    expect(fifoCompletions).toStrictEqual(["first", "second"]);
  });

  it("処理の例外は呼び出し元へ伝わる", ({ failedSettlements }) => {
    expect(failedSettlements).toStrictEqual([
      { reason: new Error("first broke"), status: "rejected" },
    ]);
  });

  it("処理が例外で失敗しても次の待機者へ順番を渡す", ({ settlementsAfterFailure }) => {
    expect(settlementsAfterFailure).toStrictEqual([
      { reason: new Error("first broke"), status: "rejected" },
      { status: "fulfilled", value: "done" },
    ]);
  });

  it("次の待機者はちょうど 1 回だけ呼ばれる", ({ nextTask }) => {
    expect(nextTask).toHaveBeenCalledOnce();
  });

  it("成功した処理の戻り値が返る", ({ firstCompletion }) => {
    expect(firstCompletion).toBe("first");
  });

  it("成功した処理の後続も順番に流れる", ({ secondCompletion }) => {
    expect(secondCompletion).toBe("second");
  });
});
