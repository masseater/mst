import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { gitExecutablePath } from "./git-executable.ts";

const directoryHolding = (fileNames: readonly string[]): string => {
  const directory = mkdtempSync(join(tmpdir(), "git-executable-"));
  onTestFinished(() => {
    rmSync(directory, { force: true, recursive: true });
  });
  for (const fileName of fileNames) {
    const filePath = join(directory, fileName);
    writeFileSync(filePath, "");
    chmodSync(filePath, 0o755);
  }
  return directory;
};

describe("gitExecutablePath", () => {
  test("the earliest directory carrying an executable git answers the search", () => {
    const withoutGit = directoryHolding([]);
    const withGit = directoryHolding(["git"]);

    expect(gitExecutablePath([withoutGit, withGit].join(delimiter))).toBe(join(withGit, "git"));
  });

  test("a windows executable answers where the plain name is absent", () => {
    const withWindowsGit = directoryHolding(["git.exe"]);

    expect(gitExecutablePath(withWindowsGit)).toBe(join(withWindowsGit, "git.exe"));
  });

  test("a file that cannot be executed does not answer the search", () => {
    const withUnrunnableGit = mkdtempSync(join(tmpdir(), "git-executable-"));
    onTestFinished(() => {
      rmSync(withUnrunnableGit, { force: true, recursive: true });
    });
    writeFileSync(join(withUnrunnableGit, "git"), "");
    chmodSync(join(withUnrunnableGit, "git"), 0o644);

    expect(gitExecutablePath(withUnrunnableGit)).toBe("git");
  });

  test("a search path carrying nothing leaves the plain name to the operating system", () => {
    expect(gitExecutablePath(directoryHolding([]))).toBe("git");
  });

  test("an absent search path leaves the plain name to the operating system", () => {
    expect(gitExecutablePath(undefined)).toBe("git");
  });

  test("a repeated search path answers with what the first search located", () => {
    const withGit = directoryHolding(["git"]);
    const locatedFirst = gitExecutablePath(withGit);
    rmSync(join(withGit, "git"));

    expect(gitExecutablePath(withGit)).toBe(locatedFirst);
  });
});
