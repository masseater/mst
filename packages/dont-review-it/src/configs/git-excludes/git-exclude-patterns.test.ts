import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { gitExcludePatterns } from "./git-exclude-patterns.ts";

vi.mock(import("node:child_process"), { spy: true });

const it = test
  .extend("patternsFromEveryExcludeFile", () => {
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
    execFileSync("git", ["init"], { cwd: repositoryRoot, env, stdio: "ignore" });
    writeFileSync(join(repositoryRoot, ".git", "info", "exclude"), "scratch/\n");
    writeFileSync(join(repositoryRoot, ".gitignore"), "dist/*\n!dist/keep.ts\n");
    return gitExcludePatterns({ cwd: repositoryRoot, env });
  })
  .extend("patternsFromXdgFallback", () => {
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
  })
  .extend("patternsFromHomeFallback", () => {
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
  })
  .extend("patternsOutsideAnyRepository", () => {
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
  })
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
  )
  .extend("unstartableGitFailure", () => {
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
  })
  .extend("patternsFromOneLineRevision", () => {
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

describe("git-exclude-patterns", () => {
  it("the global excludes file, info/exclude and the repository .gitignore all contribute", ({
    patternsFromEveryExcludeFile,
  }) => {
    expect(patternsFromEveryExcludeFile).toStrictEqual([
      ".agents/",
      "scratch/",
      "dist/*",
      "!dist/keep.ts",
    ]);
  });

  it("core.excludesFile left unset falls back to the XDG location", ({
    patternsFromXdgFallback,
  }) => {
    expect(patternsFromXdgFallback).toStrictEqual([".serena/"]);
  });

  it("core.excludesFile left unset without XDG falls back under the home directory", ({
    patternsFromHomeFallback,
  }) => {
    expect(patternsFromHomeFallback).toStrictEqual([".takt/"]);
  });

  it("a directory outside any repository with no exclude files yields no patterns", ({
    patternsOutsideAnyRepository,
  }) => {
    expect(patternsOutsideAnyRepository).toStrictEqual([]);
  });

  it("an environment that names no home falls back to the one the runtime reports", ({
    patternsWithoutHome,
    patternsWithRuntimeHome,
  }) => {
    expect(patternsWithoutHome).toStrictEqual(patternsWithRuntimeHome);
  });

  it("a git that cannot be started at all is raised rather than read as an absence", ({
    unstartableGitFailure,
  }) => {
    expect(unstartableGitFailure).toStrictEqual(
      new Error("git config --type=path --get core.excludesFile could not be run"),
    );
  });

  it("a revision answer that names only one path yields no repository exclude files", ({
    patternsFromOneLineRevision,
  }) => {
    expect(patternsFromOneLineRevision).toStrictEqual([]);
  });
});
