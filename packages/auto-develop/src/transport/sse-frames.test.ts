import { describe, expect, test } from "vite-plus/test";

import { splitFrames } from "./sse-frames.ts";

describe("splitFrames", () => {
  test("id と event と data の 3 フィールドを読み取る", () => {
    const { frames, rest } = splitFrames('id: evt-1\nevent: pull_request\ndata: {"a":1}\n\n');
    expect([frames, rest]).toStrictEqual([
      [{ id: "evt-1", event: "pull_request", data: '{"a":1}' }],
      "",
    ]);
  });

  test("同一ブロックで同じフィールドが複数回現れたら最後の行が勝つ", () => {
    const { frames } = splitFrames("data: first\ndata: second\n\n");
    expect(frames).toStrictEqual([{ data: "second" }]);
  });

  test("コメント行と retry 行と未知の行は無視される", () => {
    const { frames } = splitFrames(": comment line\nretry: 5000\nunknown line\ndata: kept\n\n");
    expect(frames).toStrictEqual([{ data: "kept" }]);
  });

  test("data を持たないブロックはブロックごと破棄される", () => {
    const { frames } = splitFrames("id: evt-1\nevent: pull_request\n\ndata: kept\n\n");
    expect(frames).toStrictEqual([{ data: "kept" }]);
  });

  test("区切りに満たない端数は rest として保持される", () => {
    const { frames, rest } = splitFrames("data: complete\n\ndata: partial");
    expect([frames, rest]).toStrictEqual([[{ data: "complete" }], "data: partial"]);
  });

  test("区切りが 1 つも無ければ全体が rest になる", () => {
    expect(splitFrames("data: partial")).toStrictEqual({ frames: [], rest: "data: partial" });
  });
});
