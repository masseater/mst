import { describe, expect, test } from "vite-plus/test";

import { engineSessionName } from "./session-name.ts";

describe("engineSessionName", () => {
  test("PR 番号から決定的なセッション名を導く", () => {
    expect(engineSessionName(7)).toStrictEqual("auto-develop-pr-7");
  });

  test("同じ PR 番号は同じ名前を返す", () => {
    expect(engineSessionName(42)).toStrictEqual(engineSessionName(42));
  });
});
