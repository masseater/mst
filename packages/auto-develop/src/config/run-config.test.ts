import { describe, expect, test } from "vite-plus/test";

import { runConfigSchema } from "./run-config.ts";

const failureMessageFrom = (parse: () => unknown): string => {
  try {
    parse();
    return "";
  } catch (parseFailure) {
    return parseFailure instanceof Error ? parseFailure.message : String(parseFailure);
  }
};

const parseTargetPrsTwice = (): {
  readonly parsedTargetPrs: readonly number[];
  readonly sharesInputInstance: boolean;
} => {
  const targetPrs = [7, 8];
  const parsedNode = runConfigSchema.parse({ targetPrs });
  return {
    parsedTargetPrs: parsedNode.targetPrs,
    sharesInputInstance: parsedNode.targetPrs === targetPrs,
  };
};

const it = test
  .extend("defaultedConfig", () => runConfigSchema.parse({}))
  .extend("concurrencyFromString", () => runConfigSchema.parse({ concurrency: "3" }).concurrency)
  .extend("concurrencyFromNumber", () => runConfigSchema.parse({ concurrency: 7 }).concurrency)
  .extend("zeroConcurrencyFailureMessage", () =>
    failureMessageFrom(() => runConfigSchema.parse({ concurrency: 0 })),
  )
  .extend(
    "engineOverrideFromInput",
    () => runConfigSchema.parse({ engineOverride: "runner profile" }).engineOverride,
  )
  .extend("unknownEngineFailureMessage", () =>
    failureMessageFrom(() => runConfigSchema.parse({ engine: "unknown-engine" })),
  )
  .extend("emptyGhUserFailureMessage", () =>
    failureMessageFrom(() => runConfigSchema.parse({ ghUser: "" })),
  )
  .extend("targetPrsRoundTrip", () => parseTargetPrsTwice());

describe("runConfigSchema", () => {
  it("デフォルトのみで解決される", ({ defaultedConfig }) => {
    expect(defaultedConfig).toStrictEqual({
      engine: "claude",
      concurrency: 3,
      dryRun: false,
      targetPrs: [],
      excludedPrs: [],
      dangerouslySkipPermissions: false,
    });
  });

  it("concurrency は文字列でも数値化して保持する", ({ concurrencyFromString }) => {
    expect(concurrencyFromString).toStrictEqual(3);
  });

  it("concurrency は数値をそのまま受ける", ({ concurrencyFromNumber }) => {
    expect(concurrencyFromNumber).toStrictEqual(7);
  });

  it("concurrency 0 は検証時に拒否される", ({ zeroConcurrencyFailureMessage }) => {
    expect(zeroConcurrencyFailureMessage).toContain("Too small: expected number to be >=1");
  });

  it("engineOverride は解決結果にそのまま現れる", ({ engineOverrideFromInput }) => {
    expect(engineOverrideFromInput).toStrictEqual("runner profile");
  });

  it("列挙外のエンジンは拒否される", ({ unknownEngineFailureMessage }) => {
    expect(unknownEngineFailureMessage).toContain("invalid_value");
  });

  it("空文字列の ghUser は拒否される", ({ emptyGhUserFailureMessage }) => {
    expect(emptyGhUserFailureMessage).toContain(
      "Too small: expected string to have >=1 characters",
    );
  });

  it("配列の中身は入力どおりに解決される", ({ targetPrsRoundTrip }) => {
    expect(targetPrsRoundTrip.parsedTargetPrs).toStrictEqual([7, 8]);
  });

  it("配列はコピーされ入力と別のインスタンスになる", ({ targetPrsRoundTrip }) => {
    expect(targetPrsRoundTrip.sharesInputInstance).toStrictEqual(false);
  });
});
