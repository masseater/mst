import { describe, expect, test, vi } from "vite-plus/test";

import { emitCliReport } from "./cli-report.ts";

describe("emitCliReport", () => {
  describe("a result carrying output", () => {
    const it = test.extend("writeOutput", () => {
      const writeOutput = vi.fn<(text: string) => void>();
      emitCliReport(
        { exitCode: 0, out: "problems\n", error: "" },
        {
          writeOutput,
          writeError: vi.fn<(text: string) => void>(),
          setExitCode: vi.fn<(exitCode: number) => void>(),
        },
      );
      return writeOutput;
    });

    it("writes the report", ({ writeOutput }) => {
      expect(writeOutput).toHaveBeenCalledExactlyOnceWith("problems\n");
    });
  });

  describe("a result carrying a diagnostic", () => {
    const it = test.extend("writeError", () => {
      const writeError = vi.fn<(text: string) => void>();
      emitCliReport(
        { exitCode: 0, out: "", error: "diagnostic\n" },
        {
          writeOutput: vi.fn<(text: string) => void>(),
          writeError,
          setExitCode: vi.fn<(exitCode: number) => void>(),
        },
      );
      return writeError;
    });

    it("writes the diagnostic", ({ writeError }) => {
      expect(writeError).toHaveBeenCalledExactlyOnceWith("diagnostic\n");
    });
  });

  describe("a result without output", () => {
    const it = test.extend("writeOutput", () => {
      const writeOutput = vi.fn<(text: string) => void>();
      emitCliReport(
        { exitCode: 0, out: "", error: "" },
        {
          writeOutput,
          writeError: vi.fn<(text: string) => void>(),
          setExitCode: vi.fn<(exitCode: number) => void>(),
        },
      );
      return writeOutput;
    });

    it("does not write a report", ({ writeOutput }) => {
      expect(writeOutput).not.toHaveBeenCalled();
    });
  });

  describe("a result without a diagnostic", () => {
    const it = test.extend("writeError", () => {
      const writeError = vi.fn<(text: string) => void>();
      emitCliReport(
        { exitCode: 0, out: "", error: "" },
        {
          writeOutput: vi.fn<(text: string) => void>(),
          writeError,
          setExitCode: vi.fn<(exitCode: number) => void>(),
        },
      );
      return writeError;
    });

    it("does not write a diagnostic", ({ writeError }) => {
      expect(writeError).not.toHaveBeenCalled();
    });
  });

  describe("the requested exit code", () => {
    const it = test.extend("setExitCode", () => {
      const setExitCode = vi.fn<(exitCode: number) => void>();
      emitCliReport(
        { exitCode: 7, out: "", error: "" },
        {
          writeOutput: vi.fn<(text: string) => void>(),
          writeError: vi.fn<(text: string) => void>(),
          setExitCode,
        },
      );
      return setExitCode;
    });

    it("reaches the exit boundary", ({ setExitCode }) => {
      expect(setExitCode).toHaveBeenCalledExactlyOnceWith(7);
    });
  });
});
