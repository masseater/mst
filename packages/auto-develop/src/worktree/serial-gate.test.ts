import { describe, expect, test, vi } from "vite-plus/test";

import { createSerialGate } from "./serial-gate.ts";

describe("createSerialGate", () => {
  test("処理を FIFO で 1 件ずつ流す", async () => {
    const gate = createSerialGate();
    const firstValue = gate.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "first";
    });
    const secondValue = gate.run(() => Promise.resolve("second"));
    expect(await Promise.all([firstValue, secondValue])).toStrictEqual(["first", "second"]);
  });

  test("処理が例外で失敗しても次の待機者へ順番を渡す", async () => {
    const gate = createSerialGate();
    const nextTask = vi.fn<() => Promise<string>>(() => Promise.resolve("done"));
    const failing = gate.run(() => Promise.reject(new Error("first broke")));
    const following = gate.run(nextTask);
    await expect(failing).rejects.toThrow("first broke");
    expect(await following).toStrictEqual("done");
    expect(nextTask).toHaveBeenCalledTimes(1);
  });

  test("成功した処理の後続も順番に流れる", async () => {
    const gate = createSerialGate();
    const firstValue = await gate.run(() => Promise.resolve("first"));
    const secondValue = await gate.run(() => Promise.resolve("second"));
    expect([firstValue, secondValue]).toStrictEqual(["first", "second"]);
  });
});
