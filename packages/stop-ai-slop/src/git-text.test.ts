import { describe, expect, test } from "vite-plus/test";

import { runGitText } from "./git-text.ts";

describe("runGitText", () => {
  describe("a successful Git command that writes to stderr", () => {
    const it = test.extend("stderrRejection", async () => {
      try {
        await runGitText({
          repositoryRoot: "/repository",
          args: ["status"],
          execute: () =>
            Promise.resolve({
              stdout: new TextEncoder().encode("clean\n"),
              stderr: new TextEncoder().encode("unexpected warning\n"),
            }),
        });
      } catch (stderrFailure) {
        return stderrFailure;
      }
      throw new Error("runGitText accepted a command that wrote to stderr");
    });

    it("rejects with an error carrying the stderr text", ({ stderrRejection }) => {
      expect(stderrRejection).toStrictEqual(
        new Error("Git command wrote to stderr: unexpected warning\n"),
      );
    });
  });
});
