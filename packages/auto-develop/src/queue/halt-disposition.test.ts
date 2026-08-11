import { describe, expect, test } from "vite-plus/test";

import { carriesHaltDisposition, HaltQueueKeepJobError } from "./halt-disposition.ts";

describe("carriesHaltDisposition", () => {
  test("恒久停止の処分指示を運ぶエラーを識別する", () => {
    expect(carriesHaltDisposition(new HaltQueueKeepJobError("engine auth expired"))).toStrictEqual(
      true,
    );
  });

  test("cause に処分指示を運ぶエラーも識別する", () => {
    const wrapped = new Error("job failed", {
      cause: new HaltQueueKeepJobError("engine auth expired"),
    });
    expect(carriesHaltDisposition(wrapped)).toStrictEqual(true);
  });

  test("通常のエラーは処分指示を運ばない", () => {
    expect(carriesHaltDisposition(new Error("flaky network"))).toStrictEqual(false);
  });

  test("エラーでない値も処分指示を運ばない", () => {
    expect(carriesHaltDisposition("broken")).toStrictEqual(false);
  });
});
