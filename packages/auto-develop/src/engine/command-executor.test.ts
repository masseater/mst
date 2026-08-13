import { describe, expect, test } from "vite-plus/test";

import { shellQuote } from "./command-executor.ts";

describe("shellQuote", () => {
  const it = test
    .extend("quotedPlainToken", () => shellQuote("hello"))
    .extend("quotedApostropheToken", () => shellQuote("it's"));

  it("トークンを単一引用符で囲む", ({ quotedPlainToken }) => {
    expect(quotedPlainToken).toStrictEqual("'hello'");
  });

  it("内部の単一引用符をエスケープする", ({ quotedApostropheToken }) => {
    expect(quotedApostropheToken).toStrictEqual("'it'\\''s'");
  });
});
