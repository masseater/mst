import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitExcludePatterns } from "./git-exclude-patterns.ts";

describe("git-exclude-patterns", () => {
  const sandboxDirectory = (name: string): string => mkdtempSync(join(tmpdir(), `mst-${name}-`));

  const isolatedEnvironment = (home: string): NodeJS.ProcessEnv => ({
    GIT_CONFIG_GLOBAL: join(home, "gitconfig"),
    GIT_CONFIG_SYSTEM: "/dev/null",
    HOME: home,
    PATH: process.env.PATH ?? "",
  });

  const initializedRepository = (env: NodeJS.ProcessEnv): string => {
    const repositoryRoot = sandboxDirectory("git-excludes-repository");
    execFileSync("git", ["init"], { cwd: repositoryRoot, env, stdio: "ignore" });
    return repositoryRoot;
  };

  test("the global excludes file, info/exclude and the repository .gitignore all contribute", () => {
    const home = sandboxDirectory("git-excludes-home");
    writeFileSync(join(home, "global-ignore"), "# machine wide\n.agents/\n");
    writeFileSync(
      join(home, "gitconfig"),
      `[core]\n\texcludesFile = ${join(home, "global-ignore")}\n`,
    );

    const env = isolatedEnvironment(home);
    const repositoryRoot = initializedRepository(env);
    writeFileSync(join(repositoryRoot, ".git", "info", "exclude"), "scratch/\n");
    writeFileSync(join(repositoryRoot, ".gitignore"), "dist/*\n!dist/keep.ts\n");

    expect(gitExcludePatterns({ cwd: repositoryRoot, env })).toStrictEqual([
      ".agents/",
      "scratch/",
      "dist/*",
      "!dist/keep.ts",
    ]);
  });

  test("core.excludesFile left unset falls back to the XDG location", () => {
    const home = sandboxDirectory("git-excludes-home");
    const configHome = join(home, "config");
    mkdirSync(join(configHome, "git"), { recursive: true });
    writeFileSync(join(configHome, "git", "ignore"), ".serena/\n");

    const env = { ...isolatedEnvironment(home), XDG_CONFIG_HOME: configHome };

    expect(gitExcludePatterns({ cwd: home, env })).toStrictEqual([".serena/"]);
  });

  test("core.excludesFile left unset without XDG falls back under the home directory", () => {
    const home = sandboxDirectory("git-excludes-home");
    mkdirSync(join(home, ".config", "git"), { recursive: true });
    writeFileSync(join(home, ".config", "git", "ignore"), ".takt/\n");

    expect(gitExcludePatterns({ cwd: home, env: isolatedEnvironment(home) })).toStrictEqual([
      ".takt/",
    ]);
  });

  test("a directory outside any repository with no exclude files yields no patterns", () => {
    const home = sandboxDirectory("git-excludes-home");

    expect(gitExcludePatterns({ cwd: home, env: isolatedEnvironment(home) })).toStrictEqual([]);
  });
});
