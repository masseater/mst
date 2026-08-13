import { describe, expect, test } from "vite-plus/test";

import { createCliRunner, EXIT_MISUSE, EXIT_SUCCESS, type CliResult } from "./cli-result.ts";

describe("createCliRunner", () => {
  describe("a runner wrapped around an operation that resolves", () => {
    const it = test.extend("completedRun", () =>
      createCliRunner((subject: string) =>
        Promise.resolve({
          exitCode: EXIT_SUCCESS,
          out: `${subject}\n`,
          error: "",
        }),
      )("checked subject"));

    it("forwards arguments and returns a completed CLI run", ({ completedRun }) => {
      expect(completedRun).toStrictEqual({
        exitCode: EXIT_SUCCESS,
        out: "checked subject\n",
        error: "",
      });
    });
  });

  describe("a runner wrapped around an operation that rejects with an error", () => {
    const it = test.extend("errorRejectedRun", () =>
      createCliRunner(() => Promise.reject(new Error("comparison failed")))());

    it("surfaces a rejected operation as CLI misuse", ({ errorRejectedRun }) => {
      expect(errorRejectedRun).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: "comparison failed\n",
      });
    });
  });

  describe("a runner wrapped around an operation that rejects with a string", () => {
    const it = test.extend("stringRejectedRun", () => {
      const deferredRun = Promise.withResolvers<CliResult>();
      Reflect.apply(deferredRun.reject, undefined, ["comparison unavailable"]);
      return createCliRunner(() => deferredRun.promise)();
    });

    it("surfaces a non-error rejection as CLI misuse", ({ stringRejectedRun }) => {
      expect(stringRejectedRun).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: "comparison unavailable\n",
      });
    });
  });
});
