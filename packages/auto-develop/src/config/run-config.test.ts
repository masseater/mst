import { describe, expect, test } from "vite-plus/test";

import { runConfigSchema } from "./run-config.ts";

describe("runConfigSchema", () => {
  test("デフォルトのみで解決される", () => {
    expect(runConfigSchema.parse({})).toStrictEqual({
      engine: "claude",
      concurrency: 3,
      dryRun: false,
      targetPrs: [],
      excludedPrs: [],
      dangerouslySkipPermissions: false,
    });
  });

  test("concurrency は文字列でも数値化して保持する", () => {
    expect(runConfigSchema.parse({ concurrency: "3" }).concurrency).toStrictEqual(3);
  });

  test("concurrency は数値をそのまま受ける", () => {
    expect(runConfigSchema.parse({ concurrency: 7 }).concurrency).toStrictEqual(7);
  });

  test("concurrency 0 は検証時に拒否される", () => {
    expect(() => runConfigSchema.parse({ concurrency: 0 })).toThrow(
      "Too small: expected number to be >=1",
    );
  });

  test("engineOverride は解決結果にそのまま現れる", () => {
    expect(
      runConfigSchema.parse({ engineOverride: "runner profile" }).engineOverride,
    ).toStrictEqual("runner profile");
  });

  test("列挙外のエンジンは拒否される", () => {
    expect(() => runConfigSchema.parse({ engine: "unknown-engine" })).toThrow("invalid_value");
  });

  test("空文字列の ghUser は拒否される", () => {
    expect(() => runConfigSchema.parse({ ghUser: "" })).toThrow(
      "Too small: expected string to have >=1 characters",
    );
  });

  test("配列はコピーされ入力と別のインスタンスになる", () => {
    const targetPrs = [7, 8];
    const parsed = runConfigSchema.parse({ targetPrs });
    expect([parsed.targetPrs, parsed.targetPrs === targetPrs]).toStrictEqual([[7, 8], false]);
  });
});
