import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readGitSourceScope } from "./git-ignored-source.ts";
import { gitOutput } from "./git-output.ts";

describe("git-ignored-source", () => {
  const isGitIgnoredSource = (sourcePath: string, repositoryRoot: string): boolean =>
    readGitSourceScope(repositoryRoot).isIgnored(sourcePath);
  const inRepository = (evaluate: (root: string) => void): void => {
    const root = mkdtempSync(join(tmpdir(), "git-ignored-source-"));
    gitOutput(["init", "--quiet"], { cwd: root, env: process.env });
    try {
      evaluate(root);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  };

  test("ignored files and directories do not become repository sources", () => {
    inRepository((root) => {
      writeFileSync(join(root, ".gitignore"), "dist\n*.generated.ts\n");
      mkdirSync(join(root, "dist"));
      mkdirSync(join(root, "fixtures"));
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "dist/status.ts"), "export {};");
      writeFileSync(join(root, "fixtures/status.ts"), "export {};");
      writeFileSync(join(root, "src/status.generated.ts"), "export {};");
      writeFileSync(join(root, "src/status.ts"), "export {};");

      expect(isGitIgnoredSource(join(root, "dist/status.ts"), root)).toBe(true);
      expect(isGitIgnoredSource(join(root, "src/status.generated.ts"), root)).toBe(true);
      expect(isGitIgnoredSource(join(root, "src/status.ts"), root)).toBe(false);
    });
  });

  test("tracked files stay repository sources even when a later pattern matches", () => {
    inRepository((root) => {
      mkdirSync(join(root, "dist"));
      writeFileSync(join(root, "dist/status.ts"), "export {};");
      gitOutput(["add", "dist/status.ts"], { cwd: root, env: process.env });
      writeFileSync(join(root, ".gitignore"), "dist\n");

      expect(isGitIgnoredSource(join(root, "dist/status.ts"), root)).toBe(false);
    });
  });

  test("an ignored symbolic-link ancestor excludes its target path", () => {
    inRepository((root) => {
      const target = mkdtempSync(join(tmpdir(), "git-ignored-target-"));
      try {
        writeFileSync(join(root, ".gitignore"), ".local-agents\n");
        writeFileSync(join(target, "status.ts"), "export {};");
        symlinkSync(target, join(root, ".local-agents"));

        expect(isGitIgnoredSource(join(root, ".local-agents/status.ts"), root)).toBe(true);
      } finally {
        rmSync(target, { force: true, recursive: true });
      }
    });
  });

  test("a parent repository index cannot change a child repository ignore result", () => {
    inRepository((root) => {
      writeFileSync(join(root, ".gitignore"), "dist\n");
      mkdirSync(join(root, "dist"));
      writeFileSync(join(root, "dist/status.ts"), "export {};");
      vi.stubEnv("GIT_INDEX_FILE", join(root, "foreign-index"));

      try {
        expect(isGitIgnoredSource(join(root, "dist/status.ts"), root)).toBe(true);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  test("paths outside the repository do not inherit repository ignores", () => {
    inRepository((root) => {
      const outside = mkdtempSync(join(tmpdir(), "git-ignored-outside-"));
      try {
        writeFileSync(join(root, ".gitignore"), "*.ts\n");
        writeFileSync(join(outside, "status.ts"), "export {};");

        expect(isGitIgnoredSource(join(outside, "status.ts"), root)).toBe(false);
      } finally {
        rmSync(outside, { force: true, recursive: true });
      }
    });
  });

  test("a source scope filters several paths with one Git snapshot", () => {
    inRepository((root) => {
      mkdirSync(join(root, "dist"));
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, ".gitignore"), "dist\n");
      writeFileSync(join(root, "dist/status.ts"), "export {};");
      writeFileSync(join(root, "src/status.ts"), "export {};");

      const scope = readGitSourceScope(root);
      expect(
        new Set(
          ["dist/status.ts", "src/status.ts"]
            .map((sourcePath) => join(root, sourcePath))
            .filter(scope.isIgnored),
        ),
      ).toStrictEqual(new Set([join(root, "dist/status.ts")]));
    });
  });

  test("a missing repository root has no ignored sources", () => {
    const root = join(tmpdir(), "missing-git-source-scope");

    expect(isGitIgnoredSource(join(root, "dist/status.ts"), root)).toBe(false);
  });

  test("a repository reached through a symbolic root uses its physical source paths", () => {
    inRepository((root) => {
      const parent = mkdtempSync(join(tmpdir(), "git-source-root-link-"));
      const linkedRoot = join(parent, "repository");
      try {
        writeFileSync(join(root, ".gitignore"), "dist\n");
        mkdirSync(join(root, "dist"));
        writeFileSync(join(root, "dist/status.ts"), "export {};");
        symlinkSync(root, linkedRoot);

        expect(isGitIgnoredSource(join(root, "dist/status.ts"), linkedRoot)).toBe(true);
      } finally {
        rmSync(parent, { force: true, recursive: true });
      }
    });
  });
});
