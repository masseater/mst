import { describe, expect, test } from "vite-plus/test";

import { splitFrames } from "./sse-frames.ts";

describe("splitFrames", () => {
  describe("id と event と data の 3 フィールドが並ぶブロック", () => {
    const it = test.extend("fullFieldSplit", () =>
      splitFrames('id: evt-1\nevent: pull_request\ndata: {"a":1}\n\n'));

    it("3 つのフィールドを読み取ったフレームになる", ({ fullFieldSplit }) => {
      expect(fullFieldSplit).toStrictEqual({
        frames: [{ id: "evt-1", event: "pull_request", data: '{"a":1}' }],
        rest: "",
      });
    });
  });

  describe("区切りで終わる入力", () => {
    const it = test.extend("terminatedSplit", () =>
      splitFrames('id: evt-1\nevent: pull_request\ndata: {"a":1}\n\n'));

    it("端数を残さない", ({ terminatedSplit }) => {
      expect(terminatedSplit).toStrictEqual({
        frames: [{ id: "evt-1", event: "pull_request", data: '{"a":1}' }],
        rest: "",
      });
    });
  });

  describe("同一ブロックで同じフィールドが複数回現れる入力", () => {
    const it = test.extend("repeatedFieldSplit", () =>
      splitFrames("data: first\ndata: second\n\n"));

    it("最後の行が勝ったフレームになる", ({ repeatedFieldSplit }) => {
      expect(repeatedFieldSplit).toStrictEqual({ frames: [{ data: "second" }], rest: "" });
    });
  });

  describe("コメント行と retry 行と未知の行を含むブロック", () => {
    const it = test.extend("noiseLineSplit", () =>
      splitFrames(": comment line\nretry: 5000\nunknown line\ndata: kept\n\n"));

    it("それらを無視したフレームになる", ({ noiseLineSplit }) => {
      expect(noiseLineSplit).toStrictEqual({ frames: [{ data: "kept" }], rest: "" });
    });
  });

  describe("data を持たないブロックが先に並ぶ入力", () => {
    const it = test.extend("dataLessBlockSplit", () =>
      splitFrames("id: evt-1\nevent: pull_request\n\ndata: kept\n\n"));

    it("そのブロックをまるごと破棄する", ({ dataLessBlockSplit }) => {
      expect(dataLessBlockSplit).toStrictEqual({ frames: [{ data: "kept" }], rest: "" });
    });
  });

  describe("区切りを満たすブロックの後ろに端数が続く入力", () => {
    const it = test.extend("completedBlockSplit", () =>
      splitFrames("data: complete\n\ndata: partial"));

    it("区切りを満たすブロックだけがフレームになる", ({ completedBlockSplit }) => {
      expect(completedBlockSplit).toStrictEqual({
        frames: [{ data: "complete" }],
        rest: "data: partial",
      });
    });
  });

  describe("区切りを満たすブロックの後ろに続く端数", () => {
    const it = test.extend("partialTailSplit", () =>
      splitFrames("data: complete\n\ndata: partial"));

    it("rest として保持される", ({ partialTailSplit }) => {
      expect(partialTailSplit).toStrictEqual({
        frames: [{ data: "complete" }],
        rest: "data: partial",
      });
    });
  });

  describe("区切りが 1 つも無い入力", () => {
    const it = test.extend("separatorLessSplit", () => splitFrames("data: partial"));

    it("全体が rest になる", ({ separatorLessSplit }) => {
      expect(separatorLessSplit).toStrictEqual({ frames: [], rest: "data: partial" });
    });
  });
});
