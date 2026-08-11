import { describe, expect, test, vi } from "vite-plus/test";

import { isCiEnvironment, readEnvVar, wholeEnv } from "./env.ts";

describe("readEnvVar", () => {
  test("非空の値はそのまま返る", () => {
    expect(readEnvVar("LANE_NAME", { LANE_NAME: "pr-7" })).toStrictEqual("pr-7");
  });

  test("空文字列は未設定として undefined になる", () => {
    expect(readEnvVar("LANE_NAME", { LANE_NAME: "" })).toStrictEqual(undefined);
  });

  test("未定義は undefined になる", () => {
    expect(readEnvVar("LANE_NAME", {})).toStrictEqual(undefined);
  });

  test("文字列以外が入っていたら変数名を含む型エラーで落ちる", () => {
    expect(() => readEnvVar("LANE_NAME", { LANE_NAME: 7 })).toThrow(
      new TypeError("LANE_NAME must be a string when set"),
    );
  });

  test("env を渡さなければプロセスの環境を読む", () => {
    vi.stubEnv("AUTO_DEVELOP_ENV_PROBE", "probe-value");
    expect(readEnvVar("AUTO_DEVELOP_ENV_PROBE")).toStrictEqual("probe-value");
    vi.unstubAllEnvs();
  });
});

describe("wholeEnv", () => {
  test("環境全体をそのまま返す", () => {
    vi.stubEnv("AUTO_DEVELOP_ENV_PROBE", "probe-value");
    expect(wholeEnv().AUTO_DEVELOP_ENV_PROBE).toStrictEqual("probe-value");
    vi.unstubAllEnvs();
  });
});

describe("isCiEnvironment", () => {
  test("CI が文字列 true のときだけ CI と判定する", () => {
    expect(isCiEnvironment({ CI: "true" })).toStrictEqual(true);
  });

  test("それ以外の値はローカル扱いになる", () => {
    expect(isCiEnvironment({ CI: "1" })).toStrictEqual(false);
  });

  test("env を渡さなければプロセスの環境を読む", () => {
    vi.stubEnv("CI", "true");
    expect(isCiEnvironment()).toStrictEqual(true);
    vi.unstubAllEnvs();
  });
});
