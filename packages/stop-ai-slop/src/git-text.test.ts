import { describe, expect, it } from "vite-plus/test";

import { runGitText } from "./git-text.ts";

describe("runGitText", () => {
  it("rejects a successful Git command that writes to stderr", async () => {
    await expect(
      runGitText({
        repositoryRoot: "/repository",
        args: ["status"],
        execute: () =>
          Promise.resolve({
            stdout: Buffer.from("clean\n"),
            stderr: Buffer.from("unexpected warning\n"),
          }),
      }),
    ).rejects.toThrow("Git command wrote to stderr: unexpected warning");
  });
});
