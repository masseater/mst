import { describe, expect, test, vi } from "vite-plus/test";

import { readEnvVar } from "./env.ts";

describe("readEnvVar", () => {
  describe("非空の文字列が入った env", () => {
    const it = test.extend("populatedLaneName", () =>
      readEnvVar("LANE_NAME", { LANE_NAME: "pr-7" }));

    it("入っている値がそのまま返る", ({ populatedLaneName }) => {
      expect(populatedLaneName).toBe("pr-7");
    });
  });

  describe("空文字列が入った env", () => {
    const it = test.extend("emptyLaneName", () => readEnvVar("LANE_NAME", { LANE_NAME: "" }));

    it("未設定として undefined が返る", ({ emptyLaneName }) => {
      expect(emptyLaneName).toBe(undefined);
    });
  });

  describe("そのキーを持たない env", () => {
    const it = test.extend("missingLaneName", () => readEnvVar("LANE_NAME", {}));

    it("未設定として undefined が返る", ({ missingLaneName }) => {
      expect(missingLaneName).toBe(undefined);
    });
  });

  describe("文字列以外が入った env", () => {
    const it = test.extend("laneNameRejection", () => {
      try {
        readEnvVar("LANE_NAME", { LANE_NAME: 7 });
      } catch (laneNameFailure) {
        return String(laneNameFailure);
      }
      throw new Error("文字列以外が入った LANE_NAME が拒否されなかった");
    });

    it("文字列であるべきことを述べる型エラーで拒否される", ({ laneNameRejection }) => {
      expect(laneNameRejection).toBe("TypeError: LANE_NAME must be a string when set");
    });
  });

  describe("文字列以外が入った、別の綴りのキーを持つ env", () => {
    const it = test.extend("runIdRejection", () => {
      try {
        readEnvVar("RUN_ID", { RUN_ID: 7 });
      } catch (runIdFailure) {
        return String(runIdFailure);
      }
      throw new Error("文字列以外が入った RUN_ID が拒否されなかった");
    });

    it("拒否のメッセージは読もうとしたキーの綴りを載せる", ({ runIdRejection }) => {
      expect(runIdRejection).toBe("TypeError: RUN_ID must be a string when set");
    });
  });

  describe("env を渡さない呼び出し", () => {
    const it = test.extend("probeFromProcessEnv", () => {
      vi.stubEnv("AUTO_DEVELOP_ENV_PROBE", "probe-value");
      return readEnvVar("AUTO_DEVELOP_ENV_PROBE");
    });

    it("プロセスの環境に置かれた値が返る", ({ probeFromProcessEnv }) => {
      expect(probeFromProcessEnv).toBe("probe-value");
    });
  });
});
