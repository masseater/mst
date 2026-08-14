import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, onTestFinished, vi } from "vite-plus/test";

import type { CliResult } from "@mst/repository-checks";

const runAgenticDocumentsMock = vi.hoisted(() =>
  vi.fn<(argv: readonly string[]) => Promise<CliResult>>(),
);

vi.mock(import("./run-cli.ts"), () => ({ runAgenticDocuments: runAgenticDocumentsMock }));

describe("cli entrypoint", () => {
  const runEntry = async (answer: CliResult): Promise<void> => {
    const previousExitCode = process.exitCode;
    const expectedArguments = process.argv.slice(2);
    vi.resetModules();
    runAgenticDocumentsMock.mockResolvedValue(answer);
    onTestFinished(() => {
      runAgenticDocumentsMock.mockReset();
      process.exitCode = previousExitCode;
    });

    await import("./cli.ts");

    expect(runAgenticDocumentsMock).toHaveBeenCalledExactlyOnceWith(expectedArguments);
    expect(process.exitCode).toBe(answer.exitCode);
  };

  standardIoTest(
    "it passes arguments through and publishes both output channels",
    async ({ stdout, stderr }) => {
      await runEntry({ exitCode: 7, out: "problems\n", error: "diagnostic\n" });

      expect(stdout.text).toMatchInlineSnapshot(`"problems\n"`);
      expect(stderr.text).toMatchInlineSnapshot(`"diagnostic\n"`);
    },
  );

  standardIoTest("it writes neither channel for empty output", async ({ stdout, stderr }) => {
    await runEntry({ exitCode: 0, out: "", error: "" });

    expect(stdout.text).toMatchInlineSnapshot(`""`);
    expect(stderr.text).toMatchInlineSnapshot(`""`);
  });
});
