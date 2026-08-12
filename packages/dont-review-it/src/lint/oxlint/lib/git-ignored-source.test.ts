import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { isGitIgnoredSource } from "./git-ignored-source.ts";
import { isOutOfScopeBoundarySource } from "./out-of-scope-boundary-source.ts";

describe("git-ignored-source", () => {
  const inRepository = (evaluate: (root: string) => void): void => {
    const root = mkdtempSync(join(tmpdir(), "git-ignored-source-"));
    execFileSync("git", ["init", "--quiet"], { cwd: root });
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
      expect(isOutOfScopeBoundarySource(join(root, "dist/status.ts"), root)).toBe(false);
      expect(isOutOfScopeBoundarySource(join(root, "fixtures/status.ts"), root)).toBe(true);
    });
  });

  test("tracked files stay repository sources even when a later pattern matches", () => {
    inRepository((root) => {
      mkdirSync(join(root, "dist"));
      writeFileSync(join(root, "dist/status.ts"), "export {};");
      execFileSync("git", ["add", "dist/status.ts"], { cwd: root });
      writeFileSync(join(root, ".gitignore"), "dist\n");

      expect(isGitIgnoredSource(join(root, "dist/status.ts"), root)).toBe(false);
      expect(isOutOfScopeBoundarySource(join(root, "dist/status.ts"), root)).toBe(true);
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
});
