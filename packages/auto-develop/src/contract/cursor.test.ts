import { describe, expect, test } from "vite-plus/test";

import { connectionCursorId } from "./cursor.ts";

describe("connectionCursorId", () => {
  describe("大文字を含むログイン名", () => {
    const it = test.extend("mixedCaseLoginCursorId", () =>
      connectionCursorId("OctoCat", "reviewer"));

    it("ログイン名を小文字化してモードと連結する", ({ mixedCaseLoginCursorId }) => {
      expect(mixedCaseLoginCursorId).toStrictEqual("octocat-reviewer");
    });
  });

  describe("大文字小文字だけ異なる 2 つのログイン名", () => {
    const it = test
      .extend("upperCaseLoginCursorId", () => connectionCursorId("HUBOT", "author"))
      .extend("lowerCaseLoginCursorId", () => connectionCursorId("hubot", "author"));

    it("大文字小文字だけ異なるログインは同じ名前空間に落ちる", ({
      upperCaseLoginCursorId,
      lowerCaseLoginCursorId,
    }) => {
      expect(upperCaseLoginCursorId).toStrictEqual(lowerCaseLoginCursorId);
    });
  });
});
