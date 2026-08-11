import { describe, expect, test } from "vite-plus/test";

import { shellQuote } from "./command-executor.ts";

describe("shellQuote", () => {
  test("トークンを単一引用符で囲む", () => {
    expect(shellQuote("hello")).toStrictEqual("'hello'");
  });

  test("内部の単一引用符をエスケープする", () => {
    expect(shellQuote("it's")).toStrictEqual("'it'\\''s'");
  });
});
