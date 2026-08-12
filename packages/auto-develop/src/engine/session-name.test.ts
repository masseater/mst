import { describe, expect, test } from "vite-plus/test";

import { engineSessionName } from "./session-name.ts";

const it = test
  .extend("nameForSeven", () => engineSessionName(7))
  .extend("firstNameForFortyTwo", () => engineSessionName(42))
  .extend("secondNameForFortyTwo", () => engineSessionName(42));

describe("engineSessionName", () => {
  it("PR 番号から決定的なセッション名を導く", ({ nameForSeven }) => {
    expect(nameForSeven).toStrictEqual("auto-develop-pr-7");
  });

  it("同じ PR 番号は同じ名前を返す", ({ firstNameForFortyTwo, secondNameForFortyTwo }) => {
    expect(firstNameForFortyTwo).toStrictEqual(secondNameForFortyTwo);
  });
});
