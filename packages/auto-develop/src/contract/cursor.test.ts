import { describe, expect, test } from "vite-plus/test";

import { connectionCursorId } from "./cursor.ts";

describe("connectionCursorId", () => {
  test("ログイン名を小文字化してモードと連結する", () => {
    expect(connectionCursorId("OctoCat", "reviewer")).toStrictEqual("octocat-reviewer");
  });

  test("大文字小文字だけ異なるログインは同じ名前空間に落ちる", () => {
    expect(connectionCursorId("HUBOT", "author")).toStrictEqual(
      connectionCursorId("hubot", "author"),
    );
  });
});
