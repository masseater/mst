import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import type { CliResult } from "@mst/utils";

const runDontReviewItMock = vi.hoisted(() => vi.fn<(argv: readonly string[]) => CliResult>());

vi.mock(import("./run-cli.ts"), () => ({ runDontReviewIt: runDontReviewItMock }));

const executeCli = async (answer: CliResult) => {
  const previousExitCode = process.exitCode;
  vi.resetModules();
  runDontReviewItMock.mockReturnValue(answer);
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  onTestFinished(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    runDontReviewItMock.mockReset();
    process.exitCode = previousExitCode;
  });

  await import("./cli.ts");

  return { stdoutWrite, stderrWrite };
};

describe("cli entrypoint", () => {
  test("it passes process arguments through and publishes both output channels", async () => {
    const { stdoutWrite, stderrWrite } = await executeCli({
      exitCode: 7,
      out: "problems\n",
      error: "diagnostic\n",
    });

    expect(runDontReviewItMock).toHaveBeenCalledExactlyOnceWith(process.argv.slice(2));
    expect(stdoutWrite).toHaveBeenCalledExactlyOnceWith("problems\n");
    expect(stderrWrite).toHaveBeenCalledExactlyOnceWith("diagnostic\n");
    expect(process.exitCode).toBe(7);
  });

  test("it writes neither channel when the command answered with empty text", async () => {
    const { stdoutWrite, stderrWrite } = await executeCli({
      exitCode: 0,
      out: "",
      error: "",
    });

    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });
});
