import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { gitExcludePatterns } from "./git-exclude-patterns.ts";

vi.mock(import("node:child_process"), { spy: true });

describe("gitExcludePatterns", () => {
  describe("a repository carrying a global excludes file, an info/exclude and a .gitignore", () => {
    const it = test.extend("patterns", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      writeFileSync(join(home, "global-ignore"), "# machine wide\n.agents/\n");
      writeFileSync(
        join(home, "gitconfig"),
        `[core]\n\texcludesFile = ${join(home, "global-ignore")}\n`,
      );
      const env = {
        GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
        GIT_CONFIG_SYSTEM: "/dev/null",
        HOME: home,
        PATH: process.env.PATH ?? "",
      };
      const repositoryRoot = mkdtempSync(join(tmpdir(), "mst-git-excludes-repository-"));
      mkdirSync(join(repositoryRoot, ".git", "objects"), { recursive: true });
      mkdirSync(join(repositoryRoot, ".git", "refs"), { recursive: true });
      mkdirSync(join(repositoryRoot, ".git", "info"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
      writeFileSync(join(repositoryRoot, ".git", "info", "exclude"), "scratch/\n");
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist/*\n!dist/keep.ts\n");
      return gitExcludePatterns({ cwd: repositoryRoot, env });
    });

    it("gathers all three, global first and the repository .gitignore last", ({ patterns }) => {
      expect(patterns).toStrictEqual([".agents/", "scratch/", "dist/*", "!dist/keep.ts"]);
    });
  });

  describe("core.excludesFile left unset while XDG_CONFIG_HOME names a directory", () => {
    const it = test.extend("patterns", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      const configHome = join(home, "config");
      mkdirSync(join(configHome, "git"), { recursive: true });
      writeFileSync(join(configHome, "git", "ignore"), ".serena/\n");
      return gitExcludePatterns({
        cwd: home,
        env: {
          GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
          GIT_CONFIG_SYSTEM: "/dev/null",
          HOME: home,
          PATH: process.env.PATH ?? "",
          XDG_CONFIG_HOME: configHome,
        },
      });
    });

    it("falls back to the ignore file under that directory", ({ patterns }) => {
      expect(patterns).toStrictEqual([".serena/"]);
    });
  });

  describe("core.excludesFile left unset with no XDG_CONFIG_HOME", () => {
    const it = test.extend("patterns", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      mkdirSync(join(home, ".config", "git"), { recursive: true });
      writeFileSync(join(home, ".config", "git", "ignore"), ".takt/\n");
      return gitExcludePatterns({
        cwd: home,
        env: {
          GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
          GIT_CONFIG_SYSTEM: "/dev/null",
          HOME: home,
          PATH: process.env.PATH ?? "",
        },
      });
    });

    it("falls back to the ignore file under the home directory", ({ patterns }) => {
      expect(patterns).toStrictEqual([".takt/"]);
    });
  });

  describe("a directory outside any repository holding no exclude file", () => {
    const it = test.extend("patterns", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      return gitExcludePatterns({
        cwd: home,
        env: {
          GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
          GIT_CONFIG_SYSTEM: "/dev/null",
          HOME: home,
          PATH: process.env.PATH ?? "",
        },
      });
    });

    it("yields no patterns", ({ patterns }) => {
      expect(patterns).toStrictEqual([]);
    });
  });

  describe("an environment naming no home at all", () => {
    const it = test
      .extend("homelessSandbox", () => mkdtempSync(join(tmpdir(), "mst-git-excludes-home-")))
      .extend("patternsWithoutHome", ({ homelessSandbox }) =>
        gitExcludePatterns({
          cwd: homelessSandbox,
          env: {
            GIT_CONFIG_GLOBAL: join(homelessSandbox, "gitconfig"),
            GIT_CONFIG_SYSTEM: "/dev/null",
            PATH: process.env.PATH ?? "",
          },
        }),
      )
      .extend("patternsWithRuntimeHome", ({ homelessSandbox }) =>
        gitExcludePatterns({
          cwd: homelessSandbox,
          env: {
            GIT_CONFIG_GLOBAL: join(homelessSandbox, "gitconfig"),
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: homedir(),
            PATH: process.env.PATH ?? "",
          },
        }),
      );

    it("falls back to the home the runtime reports", ({
      patternsWithoutHome,
      patternsWithRuntimeHome,
    }) => {
      expect(patternsWithoutHome).toStrictEqual(patternsWithRuntimeHome);
    });
  });

  describe("a git that cannot be started at all", () => {
    const it = test.extend("unstartableGitFailure", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      vi.mocked(execFileSync).mockImplementationOnce(() => {
        throw new Error("git could not be started at all");
      });
      const [unaskableGit] = attempt<readonly string[], Error>(() =>
        gitExcludePatterns({
          cwd: home,
          env: {
            GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: home,
            PATH: process.env.PATH ?? "",
          },
        }),
      );
      return unaskableGit;
    });

    it("is raised rather than read as an absence of patterns", ({ unstartableGitFailure }) => {
      expect(unstartableGitFailure).toStrictEqual(
        new Error("git config --type=path --get core.excludesFile could not be run"),
      );
    });
  });

  describe("a revision answer naming only one path", () => {
    const it = test.extend("patterns", () => {
      const home = mkdtempSync(join(tmpdir(), "mst-git-excludes-home-"));
      vi.mocked(execFileSync).mockReturnValueOnce("").mockReturnValueOnce("/the-only-line\n");
      return gitExcludePatterns({
        cwd: home,
        env: {
          GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
          GIT_CONFIG_SYSTEM: "/dev/null",
          HOME: home,
          PATH: process.env.PATH ?? "",
        },
      });
    });

    it("yields no repository exclude files", ({ patterns }) => {
      expect(patterns).toStrictEqual([]);
    });
  });
});
