import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, vi } from "vite-plus/test";

describe("cli entrypoint", () => {
  const it = standardIoTest.extend("theUnknownCommandRun", { auto: true }, async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.execPath, "cli.ts", "unknown"],
      exitCode: undefined,
    });
    vi.resetModules();
    await import("./cli.ts");
  });

  it("writes no report for an unknown command", ({ stdout }) => {
    expect(stdout).toMatchInlineSnapshot(`
      {
        "chunks": [],
      }
    `);
  });

  it("writes usage for an unknown command", ({ stderr }) => {
    expect(stderr).toMatchInlineSnapshot(`
      {
        "chunks": [
          "Usage: agentic-documents <command> [options]

      Commands:
        check   Report every place where a document disagrees with the repository or breaks the normative notation.

      Options:
        --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
        --write                   Rewrite generated regions instead of reporting them as stale.
      ",
        ],
      }
    `);
  });
});
