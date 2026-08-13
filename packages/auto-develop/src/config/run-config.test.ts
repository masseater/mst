import { describe, expect, test } from "vite-plus/test";

import { runConfigSchema } from "./run-config.ts";

describe("runConfigSchema", () => {
  describe("キーを 1 つも持たない入力", () => {
    const it = test.extend("defaultedRunConfig", () => runConfigSchema.parse({}));

    it("既定値だけで埋まった設定に解決される", ({ defaultedRunConfig }) => {
      expect(defaultedRunConfig).toStrictEqual({
        engine: "claude",
        concurrency: 3,
        dryRun: false,
        targetPrs: [],
        excludedPrs: [],
        dangerouslySkipPermissions: false,
      });
    });
  });

  describe("concurrency に数字の文字列を置いた入力", () => {
    const it = test.extend("stringConcurrencyRunConfig", () =>
      runConfigSchema.parse({ concurrency: "3" }));

    it("concurrency が数値に変換された設定に解決される", ({ stringConcurrencyRunConfig }) => {
      expect(stringConcurrencyRunConfig).toStrictEqual({
        engine: "claude",
        concurrency: 3,
        dryRun: false,
        targetPrs: [],
        excludedPrs: [],
        dangerouslySkipPermissions: false,
      });
    });
  });

  describe("concurrency に数値を置いた入力", () => {
    const it = test.extend("numberConcurrencyRunConfig", () =>
      runConfigSchema.parse({ concurrency: 7 }));

    it("concurrency がそのまま載った設定に解決される", ({ numberConcurrencyRunConfig }) => {
      expect(numberConcurrencyRunConfig).toStrictEqual({
        engine: "claude",
        concurrency: 7,
        dryRun: false,
        targetPrs: [],
        excludedPrs: [],
        dangerouslySkipPermissions: false,
      });
    });
  });

  describe("concurrency に 0 を置いた入力", () => {
    const it = test.extend("zeroConcurrencyRejection", () => {
      try {
        runConfigSchema.parse({ concurrency: 0 });
      } catch (zeroConcurrencyFailure) {
        return String(zeroConcurrencyFailure);
      }
      throw new Error("concurrency に 0 を置いた入力が拒否されなかった");
    });

    it("下限に届かないことを述べて拒否される", ({ zeroConcurrencyRejection }) => {
      expect(zeroConcurrencyRejection).toBe(`[
  {
    "origin": "number",
    "code": "too_small",
    "minimum": 1,
    "inclusive": true,
    "path": [
      "concurrency"
    ],
    "message": "Too small: expected number to be >=1"
  }
]`);
    });
  });

  describe("engineOverride に任意の文字列を置いた入力", () => {
    const it = test.extend("engineOverrideRunConfig", () =>
      runConfigSchema.parse({ engineOverride: "runner profile" }));

    it("engineOverride がそのまま載った設定に解決される", ({ engineOverrideRunConfig }) => {
      expect(engineOverrideRunConfig).toStrictEqual({
        engine: "claude",
        engineOverride: "runner profile",
        concurrency: 3,
        dryRun: false,
        targetPrs: [],
        excludedPrs: [],
        dangerouslySkipPermissions: false,
      });
    });
  });

  describe("engine に列挙外の綴りを置いた入力", () => {
    const it = test.extend("unknownEngineRejection", () => {
      try {
        runConfigSchema.parse({ engine: "unknown-engine" });
      } catch (unknownEngineFailure) {
        return String(unknownEngineFailure);
      }
      throw new Error("engine に列挙外の綴りを置いた入力が拒否されなかった");
    });

    it("選べる綴りを並べて拒否される", ({ unknownEngineRejection }) => {
      expect(unknownEngineRejection).toBe(`[
  {
    "code": "invalid_value",
    "values": [
      "claude",
      "codex"
    ],
    "path": [
      "engine"
    ],
    "message": "Invalid option: expected one of \\"claude\\"|\\"codex\\""
  }
]`);
    });
  });

  describe("ghUser に空文字列を置いた入力", () => {
    const it = test.extend("emptyGhUserRejection", () => {
      try {
        runConfigSchema.parse({ ghUser: "" });
      } catch (emptyGhUserFailure) {
        return String(emptyGhUserFailure);
      }
      throw new Error("ghUser に空文字列を置いた入力が拒否されなかった");
    });

    it("最短の長さに届かないことを述べて拒否される", ({ emptyGhUserRejection }) => {
      expect(emptyGhUserRejection).toBe(`[
  {
    "origin": "string",
    "code": "too_small",
    "minimum": 1,
    "inclusive": true,
    "path": [
      "ghUser"
    ],
    "message": "Too small: expected string to have >=1 characters"
  }
]`);
    });
  });

  describe("targetPrs に番号の配列を置いた入力", () => {
    const it = test
      .extend("targetPrsRunConfig", () => runConfigSchema.parse({ targetPrs: [7, 8] }))
      .extend("targetPrsSharesInputArray", () => {
        const targetPrs = [7, 8];
        return runConfigSchema.parse({ targetPrs }).targetPrs === targetPrs;
      });

    it("番号が入力の並びどおりに載った設定に解決される", ({ targetPrsRunConfig }) => {
      expect(targetPrsRunConfig).toStrictEqual({
        engine: "claude",
        concurrency: 3,
        dryRun: false,
        targetPrs: [7, 8],
        excludedPrs: [],
        dangerouslySkipPermissions: false,
      });
    });

    it("解決された配列は入力と別のインスタンスになる", ({ targetPrsSharesInputArray }) => {
      expect(targetPrsSharesInputArray).toBe(false);
    });
  });
});
