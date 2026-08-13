import { describe, expect, test } from "vite-plus/test";

import { engineSessionName } from "./session-name.ts";

describe("engineSessionName", () => {
  describe("PR 番号を 1 つ渡す", () => {
    const it = test.extend("nameForSeven", () => engineSessionName(7));

    it("PR 番号から決定的なセッション名を導く", ({ nameForSeven }) => {
      expect(nameForSeven).toStrictEqual("auto-develop-pr-7");
    });
  });

  describe("同じ PR 番号を 2 回渡す", () => {
    const it = test
      .extend("firstNameForFortyTwo", () => engineSessionName(42))
      .extend("secondNameForFortyTwo", () => engineSessionName(42));

    it("同じ PR 番号は同じ名前を返す", ({ firstNameForFortyTwo, secondNameForFortyTwo }) => {
      expect(firstNameForFortyTwo).toStrictEqual(secondNameForFortyTwo);
    });
  });
});
