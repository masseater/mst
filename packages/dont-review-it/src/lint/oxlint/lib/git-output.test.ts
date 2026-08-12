import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitOutput, repositoryAgnosticGitEnvironment } from "./git-output.ts";

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
  test("only repository-local Git variables are removed from a subprocess environment", () => {
    expect(
      repositoryAgnosticGitEnvironment({
        GIT_ALTERNATE_OBJECT_DIRECTORIES: "alternate-objects",
        GIT_COMMON_DIR: "common",
        GIT_CONFIG: "config",
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_PARAMETERS: "'feature.enabled'='true'",
        GIT_DIR: "repository",
        GIT_GRAFT_FILE: "grafts",
        GIT_IMPLICIT_WORK_TREE: "1",
        GIT_INDEX_FILE: "index",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_OBJECT_DIRECTORY: "objects",
        GIT_PREFIX: "prefix",
        GIT_REPLACE_REF_BASE: "refs/replace/",
        GIT_SHALLOW_FILE: "shallow",
        GIT_WORK_TREE: "worktree",
        HTTPS_PROXY: "https://proxy.example.invalid",
        USERPROFILE: "C:\\Users\\fixture",
        VP_HOME: "/opt/vite-plus",
      }),
    ).toStrictEqual({
      HTTPS_PROXY: "https://proxy.example.invalid",
      USERPROFILE: "C:\\Users\\fixture",
      VP_HOME: "/opt/vite-plus",
    });
  });

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
  });
});
