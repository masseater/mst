import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { gitExcludePatterns } from "./git-exclude-patterns.ts";

const UNRUNNABLE_CWD = "/mst-git-cannot-be-run";

const ONE_LINE_CWD = "/mst-git-answers-with-one-line";

vi.mock(import("node:child_process"), async (importOriginal) => {
  const real = await importOriginal();
  const execFileSync = ((...call: Parameters<typeof real.execFileSync>) => {
    const [, , options] = call;
    const where = (options as { readonly cwd?: string } | undefined)?.cwd;
    if (where === UNRUNNABLE_CWD) throw new Error("git could not be started at all");
    if (where === ONE_LINE_CWD) return "/the-only-line\n";
    return real.execFileSync(...call);
  }) as typeof real.execFileSync;
  return { ...real, execFileSync };
});

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

  test("an environment that names no home falls back to the one the runtime reports", () => {
    const home = sandboxDirectory("git-excludes-home");
    const { HOME, ...withoutHome } = isolatedEnvironment(home);

    expect(gitExcludePatterns({ cwd: home, env: withoutHome })).toStrictEqual(
      gitExcludePatterns({ cwd: home, env: { ...withoutHome, HOME: homedir() } }),
    );
  });

  test("a git that cannot be started at all is raised rather than read as an absence", () => {
    const home = sandboxDirectory("git-excludes-home");

    expect(() =>
      gitExcludePatterns({ cwd: UNRUNNABLE_CWD, env: isolatedEnvironment(home) }),
    ).toThrow("could not be run");
  });

  test("a revision answer that names only one path yields no repository exclude files", () => {
    const home = sandboxDirectory("git-excludes-home");

    expect(gitExcludePatterns({ cwd: ONE_LINE_CWD, env: isolatedEnvironment(home) })).toStrictEqual(
      [],
    );
  });
});
