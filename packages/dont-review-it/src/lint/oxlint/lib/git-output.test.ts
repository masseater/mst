import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { gitOutput } from "./git-output.ts";

describe("gitOutput", () => {
  test("a hook environment naming another repository does not redirect the question", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "mst-git-output-"));
    onTestFinished(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    const env = {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      HOME: process.env.HOME ?? "",
      PATH: process.env.PATH ?? "",
    };
    execFileSync("git", ["init"], { cwd: repositoryRoot, env, stdio: "ignore" });
    writeFileSync(join(repositoryRoot, "listed.txt"), "");
    execFileSync("git", ["add", "--", "listed.txt"], { cwd: repositoryRoot, env, stdio: "ignore" });

    const answer = gitOutput(["ls-files", "--cached"], {
      cwd: repositoryRoot,
      env: { ...env, GIT_DIR: "/nonexistent-git-dir", GIT_INDEX_FILE: "/nonexistent-index" },
    });

    expect(answer).toBe("listed.txt");
  });
});
