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
          "Usage: stop-ai-slop check [--base <revision> --head <revision>] [--repository-root <path>]

      Commands:
        check   Run every registered check in definition order.

      Options:
        --base <revision>         Git revision before the change. Requires --head.
        --head <revision>         Git revision after the change. Requires --base.
        --repository-root <path>  Root of the Git repository. Defaults to the current working directory.

      Without --base and --head the change on its way into the integration branch is compared:
      the staged merge result when a merge is in progress, and the history since it left
      origin/main otherwise.
      ",
        ],
      }
    `);
  });
});
