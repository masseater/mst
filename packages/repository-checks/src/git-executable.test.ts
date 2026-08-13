import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitExecutablePath } from "./git-executable.ts";

const LEADING_EMPTY_DIRECTORY = join(tmpdir(), "git-executable-leading-empty");
const TRAILING_GIT_DIRECTORY = join(tmpdir(), "git-executable-trailing-git");
const WINDOWS_GIT_DIRECTORY = join(tmpdir(), "git-executable-windows-git");
const UNRUNNABLE_GIT_DIRECTORY = join(tmpdir(), "git-executable-unrunnable-git");
const NOTHING_CARRIED_DIRECTORY = join(tmpdir(), "git-executable-nothing-carried");
const REPEATED_SEARCH_DIRECTORY = join(tmpdir(), "git-executable-repeated-search");

describe("gitExecutablePath", () => {
  describe("a search path whose later directory carries an executable git", () => {
    const it = test.extend("gitPathAcrossDirectories", ({}, { onCleanup }) => {
      mkdirSync(LEADING_EMPTY_DIRECTORY, { recursive: true });
      mkdirSync(TRAILING_GIT_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(LEADING_EMPTY_DIRECTORY, { force: true, recursive: true });
        rmSync(TRAILING_GIT_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(TRAILING_GIT_DIRECTORY, "git"), "");
      chmodSync(join(TRAILING_GIT_DIRECTORY, "git"), 0o755);

      return gitExecutablePath([LEADING_EMPTY_DIRECTORY, TRAILING_GIT_DIRECTORY].join(delimiter));
    });

    it("answers with the git of the earliest directory carrying one", ({
      gitPathAcrossDirectories,
    }) => {
      expect(gitPathAcrossDirectories).toBe(join(TRAILING_GIT_DIRECTORY, "git"));
    });
  });

  describe("a directory carrying a windows executable and no plain name", () => {
    const it = test.extend("windowsGitPath", ({}, { onCleanup }) => {
      mkdirSync(WINDOWS_GIT_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(WINDOWS_GIT_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(WINDOWS_GIT_DIRECTORY, "git.exe"), "");
      chmodSync(join(WINDOWS_GIT_DIRECTORY, "git.exe"), 0o755);

      return gitExecutablePath(WINDOWS_GIT_DIRECTORY);
    });

    it("answers with the windows executable", ({ windowsGitPath }) => {
      expect(windowsGitPath).toBe(join(WINDOWS_GIT_DIRECTORY, "git.exe"));
    });
  });

  describe("a directory carrying a git file that cannot be executed", () => {
    const it = test.extend("unrunnableGitPath", ({}, { onCleanup }) => {
      mkdirSync(UNRUNNABLE_GIT_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(UNRUNNABLE_GIT_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(UNRUNNABLE_GIT_DIRECTORY, "git"), "");
      chmodSync(join(UNRUNNABLE_GIT_DIRECTORY, "git"), 0o644);

      return gitExecutablePath(UNRUNNABLE_GIT_DIRECTORY);
    });

    it("leaves the plain name to the operating system", ({ unrunnableGitPath }) => {
      expect(unrunnableGitPath).toBe("git");
    });
  });

  describe("a search path carrying nothing", () => {
    const it = test.extend("gitPathWithoutCandidates", ({}, { onCleanup }) => {
      mkdirSync(NOTHING_CARRIED_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(NOTHING_CARRIED_DIRECTORY, { force: true, recursive: true });
      });

      return gitExecutablePath(NOTHING_CARRIED_DIRECTORY);
    });

    it("leaves the plain name to the operating system", ({ gitPathWithoutCandidates }) => {
      expect(gitPathWithoutCandidates).toBe("git");
    });
  });

  describe("an absent search path", () => {
    const it = test.extend("gitPathWithoutSearchPath", () => gitExecutablePath(undefined));

    it("leaves the plain name to the operating system", ({ gitPathWithoutSearchPath }) => {
      expect(gitPathWithoutSearchPath).toBe("git");
    });
  });

  describe("a search path handed over a second time after its git file went away", () => {
    const it = test.extend("gitPathFromRepeatedSearch", ({}, { onCleanup }) => {
      mkdirSync(REPEATED_SEARCH_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(REPEATED_SEARCH_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(REPEATED_SEARCH_DIRECTORY, "git"), "");
      chmodSync(join(REPEATED_SEARCH_DIRECTORY, "git"), 0o755);
      gitExecutablePath(REPEATED_SEARCH_DIRECTORY);
      rmSync(join(REPEATED_SEARCH_DIRECTORY, "git"));

      return gitExecutablePath(REPEATED_SEARCH_DIRECTORY);
    });

    it("answers with what the first search located", ({ gitPathFromRepeatedSearch }) => {
      expect(gitPathFromRepeatedSearch).toBe(join(REPEATED_SEARCH_DIRECTORY, "git"));
    });
  });
});
