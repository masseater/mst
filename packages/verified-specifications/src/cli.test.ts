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
      .toHaveBeenCalledExactlyOnceWith(`Usage: verified-specifications <command> [options]

Commands:
  check   Extract the claims of every specification test and report each place where the structure cannot be read or a SPECIFICATIONS.md disagrees with them.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
  --write                   Rewrite each SPECIFICATIONS.md instead of reporting it as stale.
`);
  });
});
