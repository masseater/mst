import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import type { CliResult } from "@mst/repository-checks";

const runVerifiedSpecificationsMock = vi.hoisted(() =>
  vi.fn<(argv: readonly string[]) => Promise<CliResult>>(),
);

vi.mock(import("./run-cli.ts"), () => ({
  runVerifiedSpecifications: runVerifiedSpecificationsMock,
}));

describe("cli entrypoint", () => {
  test.each([
    {
      name: "it passes arguments through and publishes both output channels",
      answer: { exitCode: 7, out: "problems\n", error: "diagnostic\n" },
      stdoutCalls: [["problems\n"]],
      stderrCalls: [["diagnostic\n"]],
    },
    {
      name: "it writes neither channel for empty output",
      answer: { exitCode: 0, out: "", error: "" },
      stdoutCalls: [],
      stderrCalls: [],
    },
  ])("$name", async ({ answer, stdoutCalls, stderrCalls }) => {
    const previousExitCode = process.exitCode;
    const expectedArguments = process.argv.slice(2);
    vi.resetModules();
    runVerifiedSpecificationsMock.mockResolvedValue(answer);
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    onTestFinished(() => {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
      runVerifiedSpecificationsMock.mockReset();
      process.exitCode = previousExitCode;
    });

    await import("./cli.ts");

    expect(runVerifiedSpecificationsMock).toHaveBeenCalledExactlyOnceWith(expectedArguments);
    expect(stdoutWrite.mock.calls).toStrictEqual(stdoutCalls);
    expect(stderrWrite.mock.calls).toStrictEqual(stderrCalls);
    expect(process.exitCode).toBe(answer.exitCode);
  });
});
