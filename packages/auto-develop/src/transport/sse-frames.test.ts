import { describe, expect, test } from "vite-plus/test";

import { splitFrames } from "./sse-frames.ts";

const it = test
  .extend("fullFieldSplit", () => splitFrames('id: evt-1\nevent: pull_request\ndata: {"a":1}\n\n'))
  .extend("repeatedFieldSplit", () => splitFrames("data: first\ndata: second\n\n"))
  .extend("noiseLineSplit", () =>
    splitFrames(": comment line\nretry: 5000\nunknown line\ndata: kept\n\n"),
  )
  .extend("dataLessBlockSplit", () =>
    splitFrames("id: evt-1\nevent: pull_request\n\ndata: kept\n\n"),
  )
  .extend("partialTailSplit", () => splitFrames("data: complete\n\ndata: partial"))
  .extend("separatorLessSplit", () => splitFrames("data: partial"));

describe("splitFrames", () => {
  it("id と event と data の 3 フィールドを読み取る", ({ fullFieldSplit }) => {
    expect(fullFieldSplit.frames).toStrictEqual([
      { id: "evt-1", event: "pull_request", data: '{"a":1}' },
    ]);
  });

  it("区切りで終わる入力は端数を残さない", ({ fullFieldSplit }) => {
    expect(fullFieldSplit.rest).toStrictEqual("");
  });

  it("同一ブロックで同じフィールドが複数回現れたら最後の行が勝つ", ({ repeatedFieldSplit }) => {
    expect(repeatedFieldSplit.frames).toStrictEqual([{ data: "second" }]);
  });

  it("コメント行と retry 行と未知の行は無視される", ({ noiseLineSplit }) => {
    expect(noiseLineSplit.frames).toStrictEqual([{ data: "kept" }]);
  });

  it("data を持たないブロックはブロックごと破棄される", ({ dataLessBlockSplit }) => {
    expect(dataLessBlockSplit.frames).toStrictEqual([{ data: "kept" }]);
  });

  it("区切りを満たすブロックだけがフレームになる", ({ partialTailSplit }) => {
    expect(partialTailSplit.frames).toStrictEqual([{ data: "complete" }]);
  });

  it("区切りに満たない端数は rest として保持される", ({ partialTailSplit }) => {
    expect(partialTailSplit.rest).toStrictEqual("data: partial");
  });

  it("区切りが 1 つも無ければ全体が rest になる", ({ separatorLessSplit }) => {
    expect(separatorLessSplit).toStrictEqual({ frames: [], rest: "data: partial" });
  });
});
