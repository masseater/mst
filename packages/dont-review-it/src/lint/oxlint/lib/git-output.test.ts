import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitOutput } from "./git-output.ts";

const CLEAN_ENVIRONMENT: NodeJS.ProcessEnv = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  HOME: process.env.HOME ?? "",
  PATH: process.env.PATH ?? "",
};

describe("gitOutput", () => {
  describe("a question asked under a hook environment that names another repository", () => {
    const it = test
      .extend("repositoryRoot", () => {
        const created = mkdtempSync(join(tmpdir(), "dont-review-it-git-output-"));
        execFileSync("git", ["init"], { cwd: created, env: CLEAN_ENVIRONMENT, stdio: "ignore" });
        return realpathSync(created);
      })
      .extend("toplevelAnswered", ({ repositoryRoot }) =>
        gitOutput(["rev-parse", "--show-toplevel"], {
          cwd: repositoryRoot,
          env: {
            ...CLEAN_ENVIRONMENT,
            GIT_DIR: join(repositoryRoot, "elsewhere", ".git"),
            GIT_INDEX_FILE: join(repositoryRoot, "elsewhere", "index"),
          },
        }),
      );

    it("is answered about the asked directory, not about the repository the environment names", ({
      toplevelAnswered,
      repositoryRoot,
    }) => {
      expect(toplevelAnswered).toBe(repositoryRoot);
    });
  });

  describe("a question git answers with a failure status", () => {
    const it = test.extend("toplevelAnswered", () =>
      gitOutput(["rev-parse", "--show-toplevel"], {
        cwd: mkdtempSync(join(tmpdir(), "dont-review-it-git-output-bare-")),
        env: CLEAN_ENVIRONMENT,
      }));

    it("yields null", ({ toplevelAnswered }) => {
      expect(toplevelAnswered).toBe(null);
    });
  });
});
