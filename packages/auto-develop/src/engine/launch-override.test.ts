import { describe, expect, test } from "vite-plus/test";

import { parseLaunchOverride } from "./launch-override.ts";

describe("parseLaunchOverride", () => {
  test("undefined は上書きなしになる", () => {
    expect(parseLaunchOverride(undefined)).toStrictEqual(null);
  });

  test("空文字列は上書きなしになる", () => {
    expect(parseLaunchOverride("")).toStrictEqual(null);
  });

  test("空白のみは上書きなしになる", () => {
    expect(parseLaunchOverride("  \t ")).toStrictEqual(null);
  });

  test("単一トークンはバイナリ名だけで接頭引数は空になる", () => {
    expect(parseLaunchOverride("wrapper")).toStrictEqual({ binary: "wrapper", prefixArgs: [] });
  });

  test("複数トークンは先頭がバイナリで残りが接頭引数になる", () => {
    expect(parseLaunchOverride("  wrapper   sub  ")).toStrictEqual({
      binary: "wrapper",
      prefixArgs: ["sub"],
    });
  });
});
