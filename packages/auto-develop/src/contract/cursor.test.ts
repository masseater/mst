import { describe, expect, test } from "vite-plus/test";

import { connectionCursorId } from "./cursor.ts";

const it = test
  .extend("mixedCaseLoginCursorId", () => connectionCursorId("OctoCat", "reviewer"))
  .extend("upperCaseLoginCursorId", () => connectionCursorId("HUBOT", "author"))
  .extend("lowerCaseLoginCursorId", () => connectionCursorId("hubot", "author"));

describe("connectionCursorId", () => {
  it("ログイン名を小文字化してモードと連結する", ({ mixedCaseLoginCursorId }) => {
    expect(mixedCaseLoginCursorId).toStrictEqual("octocat-reviewer");
  });

  it("大文字小文字だけ異なるログインは同じ名前空間に落ちる", ({
    upperCaseLoginCursorId,
    lowerCaseLoginCursorId,
  }) => {
    expect(upperCaseLoginCursorId).toStrictEqual(lowerCaseLoginCursorId);
  });
});
