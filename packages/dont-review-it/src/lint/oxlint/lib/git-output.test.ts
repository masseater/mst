import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitOutput } from "./git-output.ts";

const cleanEnvironment: NodeJS.ProcessEnv = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  HOME: process.env.HOME ?? "",
  PATH: process.env.PATH ?? "",
};

const initializedRepository = (): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-git-output-"));
  execFileSync("git", ["init"], { cwd: repositoryRoot, env: cleanEnvironment, stdio: "ignore" });
  return repositoryRoot;
};

describe("gitOutput", () => {
  test("git answers about the asked directory, not about the repository a hook environment names", () => {
    const repositoryRoot = initializedRepository();

    const answer = gitOutput(["rev-parse", "--show-toplevel"], {
      cwd: repositoryRoot,
      env: {
        ...cleanEnvironment,
        GIT_DIR: join(repositoryRoot, "elsewhere", ".git"),
        GIT_INDEX_FILE: join(repositoryRoot, "elsewhere", "index"),
      },
    });

    expect(answer).toBe(realpathSync(repositoryRoot));
  }, 30_000);

  test("a question git answers with a failure status yields null", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-git-output-bare-"));

    expect(
      gitOutput(["rev-parse", "--show-toplevel"], {
        cwd: repositoryRoot,
        env: cleanEnvironment,
      }),
    ).toBe(null);
  }, 30_000);
});
