import { describe, expect, test } from "vite-plus/test";

import { parseLaunchOverride } from "./launch-override.ts";

describe("parseLaunchOverride", () => {
  const it = test
    .extend("overrideFromUndefined", () => parseLaunchOverride(undefined))
    .extend("overrideFromEmptyString", () => parseLaunchOverride(""))
    .extend("overrideFromBlankString", () => parseLaunchOverride("  \t "))
    .extend("overrideFromSingleToken", () => parseLaunchOverride("wrapper"))
    .extend("overrideFromMultipleTokens", () => parseLaunchOverride("  wrapper   sub  "));

  it("undefined は上書きなしになる", ({ overrideFromUndefined }) => {
    expect(overrideFromUndefined).toStrictEqual(null);
  });

  it("空文字列は上書きなしになる", ({ overrideFromEmptyString }) => {
    expect(overrideFromEmptyString).toStrictEqual(null);
  });

  it("空白のみは上書きなしになる", ({ overrideFromBlankString }) => {
    expect(overrideFromBlankString).toStrictEqual(null);
  });

  it("単一トークンはバイナリ名だけで接頭引数は空になる", ({ overrideFromSingleToken }) => {
    expect(overrideFromSingleToken).toStrictEqual({ binary: "wrapper", prefixArgs: [] });
  });

  it("複数トークンは先頭がバイナリで残りが接頭引数になる", ({ overrideFromMultipleTokens }) => {
    expect(overrideFromMultipleTokens).toStrictEqual({ binary: "wrapper", prefixArgs: ["sub"] });
  });
});
