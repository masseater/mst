import { describe, expect, test, vi } from "vite-plus/test";

describe("cli entrypoint", () => {
  const stdoutTest = test.extend("stdoutWrite", () => vi.fn<(text: string) => boolean>(() => true));
  const stderrTest = stdoutTest.extend("stderrWrite", () =>
    vi.fn<(text: string) => boolean>(() => true),
  );
  const it = stderrTest.extend(
    "theUnknownCommandRun",
    { auto: true },
    async ({ stdoutWrite, stderrWrite }) => {
      vi.stubGlobal("process", {
        ...process,
        argv: [process.execPath, "cli.ts", "unknown"],
        stdout: { ...process.stdout, write: stdoutWrite },
        stderr: { ...process.stderr, write: stderrWrite },
        exitCode: undefined,
      });
      vi.resetModules();
      await import("./cli.ts");
    },
  );

  it("writes no report for an unknown command", ({ stdoutWrite }) => {
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("writes usage for an unknown command", ({ stderrWrite }) => {
    expect(stderrWrite)
      .toHaveBeenCalledExactlyOnceWith(`Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md) with the rule
implementations found under the directories that the workspace manifests declare
in their lintRules field. Without --write it only reports the indexes that are
missing, unmarked, or stale; with --write it regenerates the generated region of
each index. Exits non-zero when a problem remains.

Options:
  --write                   Write the regenerated indexes instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`);
  });
});
