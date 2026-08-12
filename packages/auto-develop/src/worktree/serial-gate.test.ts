import { describe, expect, test, vi } from "vite-plus/test";

import { createSerialGate } from "./serial-gate.ts";

const it = test
  .extend("fifoCompletions", async () => {
    const gate = createSerialGate();
    const first = gate.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "first";
    });
    const second = gate.run(() => Promise.resolve("second"));
    return Promise.all([first, second]);
  })
  .extend(
    "runAfterFailure",
    async (): Promise<{
      readonly caught: Error | null;
      readonly following: string;
      readonly nextTaskCalls: readonly (readonly [])[];
    }> => {
      const gate = createSerialGate();
      const nextTask = vi.fn<() => Promise<string>>(() => Promise.resolve("done"));
      const failing = gate.run(() => Promise.reject(new Error("first broke")));
      const following = gate.run(nextTask);
      try {
        await failing;
        return { caught: null, following: await following, nextTaskCalls: nextTask.mock.calls };
      } catch (gateFailure) {
        return {
          caught: gateFailure instanceof Error ? gateFailure : null,
          following: await following,
          nextTaskCalls: nextTask.mock.calls,
        };
      }
    },
  )
  .extend("sequentialCompletions", async () => {
    const gate = createSerialGate();
    const first = await gate.run(() => Promise.resolve("first"));
    const second = await gate.run(() => Promise.resolve("second"));
    return { first, second };
  });

describe("createSerialGate", () => {
  it("処理を FIFO で 1 件ずつ流す", ({ fifoCompletions }) => {
    expect(fifoCompletions).toStrictEqual(["first", "second"]);
  });

  it("処理の例外は呼び出し元へ伝わる", ({ runAfterFailure }) => {
    expect(runAfterFailure.caught?.message).toStrictEqual("first broke");
  });

  it("処理が例外で失敗しても次の待機者へ順番を渡す", ({ runAfterFailure }) => {
    expect(runAfterFailure.following).toStrictEqual("done");
  });

  it("次の待機者はちょうど 1 回だけ呼ばれる", ({ runAfterFailure }) => {
    expect(runAfterFailure.nextTaskCalls.length).toStrictEqual(1);
  });

  it("成功した処理の戻り値が返る", ({ sequentialCompletions }) => {
    expect(sequentialCompletions.first).toStrictEqual("first");
  });

  it("成功した処理の後続も順番に流れる", ({ sequentialCompletions }) => {
    expect(sequentialCompletions.second).toStrictEqual("second");
  });
});
