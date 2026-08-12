import { describe, expect, test, vi } from "vite-plus/test";

import { readEnvVar } from "./env.ts";

const failureOf = (read: () => unknown): unknown => {
  try {
    read();
    return undefined;
  } catch (readFailure) {
    return readFailure;
  }
};

const withStubbedEnv = <TObserved>(stubbing: {
  readonly name: string;
  readonly stubbed: string;
  readonly observe: () => TObserved;
}): TObserved => {
  vi.stubEnv(stubbing.name, stubbing.stubbed);
  const observed = stubbing.observe();
  vi.unstubAllEnvs();
  return observed;
};

const it = test
  .extend("populatedLaneName", () => readEnvVar("LANE_NAME", { LANE_NAME: "pr-7" }))
  .extend("emptyLaneName", () => readEnvVar("LANE_NAME", { LANE_NAME: "" }))
  .extend("missingLaneName", () => readEnvVar("LANE_NAME", {}))
  .extend("laneNameTypeFailure", () => failureOf(() => readEnvVar("LANE_NAME", { LANE_NAME: 7 })))
  .extend("probeFromProcessEnv", () =>
    withStubbedEnv({
      name: "AUTO_DEVELOP_ENV_PROBE",
      stubbed: "probe-value",
      observe: () => readEnvVar("AUTO_DEVELOP_ENV_PROBE"),
    }),
  );

describe("readEnvVar", () => {
  it("非空の値はそのまま返る", ({ populatedLaneName }) => {
    expect(populatedLaneName).toStrictEqual("pr-7");
  });

  it("空文字列は未設定として undefined になる", ({ emptyLaneName }) => {
    expect(emptyLaneName).toStrictEqual(undefined);
  });

  it("未定義は undefined になる", ({ missingLaneName }) => {
    expect(missingLaneName).toStrictEqual(undefined);
  });

  it("文字列以外が入っていたら型エラーで落ちる", ({ laneNameTypeFailure }) => {
    expect(laneNameTypeFailure).toBeInstanceOf(TypeError);
  });

  it("型エラーのメッセージは変数名を含む", ({ laneNameTypeFailure }) => {
    expect((laneNameTypeFailure as TypeError).message).toStrictEqual(
      "LANE_NAME must be a string when set",
    );
  });

  it("env を渡さなければプロセスの環境を読む", ({ probeFromProcessEnv }) => {
    expect(probeFromProcessEnv).toStrictEqual("probe-value");
  });
});
