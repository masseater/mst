import { describe, expect, test, vi } from "vite-plus/test";

import { warnUnreleased } from "./unreleased-warning.ts";

describe("warnUnreleased", () => {
  const standardIoTest = test
    .extend("stdout", { auto: true }, () => {
      const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const writtenStdout = (): readonly string[] =>
        stdoutWrite.mock.calls.map(([writtenFragment]) =>
          typeof writtenFragment === "string"
            ? writtenFragment
            : new TextDecoder().decode(writtenFragment),
        );
      const capturedStdout = Object.fromEntries([]);
      Reflect.defineProperty(capturedStdout, "chunks", { enumerable: true, get: writtenStdout });
      Reflect.defineProperty(capturedStdout, "text", {
        value: () => writtenStdout().join(""),
      });
      return capturedStdout as {
        readonly chunks: readonly string[];
        readonly text: () => string;
      };
    })
    .extend("stderr", { auto: true }, () => {
      const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const writtenStderr = (): readonly string[] =>
        stderrWrite.mock.calls.map(([writtenFragment]) =>
          typeof writtenFragment === "string"
            ? writtenFragment
            : new TextDecoder().decode(writtenFragment),
        );
      const capturedStderr = Object.fromEntries([]);
      Reflect.defineProperty(capturedStderr, "chunks", { enumerable: true, get: writtenStderr });
      Reflect.defineProperty(capturedStderr, "text", {
        value: () => writtenStderr().join(""),
      });
      return capturedStderr as {
        readonly chunks: readonly string[];
        readonly text: () => string;
      };
    });

  describe("a slot that could not be given back", () => {
    const it = standardIoTest
      .extend("theWarningOnStandardError", ({ stderr }) => {
        warnUnreleased(new Error("releasing the slot before re-raising SIGINT failed"));
        return stderr.text();
      })
      .extend("theStandardOutputOfTheWarning", ({ stdout }) => {
        warnUnreleased(new Error("releasing the slot before re-raising SIGINT failed"));
        return stdout.text();
      });

    it("names the failure under the tool that owns the slot", ({ theWarningOnStandardError }) => {
      expect(theWarningOnStandardError).toMatchInlineSnapshot(`
        "throttle: releasing the slot before re-raising SIGINT failed
        "
      `);
    });

    it("leaves standard output untouched", ({ theStandardOutputOfTheWarning }) => {
      expect(theStandardOutputOfTheWarning).toMatchInlineSnapshot(`""`);
    });
  });
});
