import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import {
  gitIgnoredRepositoryPaths,
  gitIgnorePatternForLiteralPath,
  readGitSourceScope,
} from "./git-ignored-source.ts";
import { gitOutput, gitRawOutput } from "./git-output.ts";

vi.mock(import("./git-output.ts"), { spy: true });

describe("readGitSourceScope", () => {
  describe("a concrete repository path containing Git ignore metacharacters", () => {
    const it = test.extend("literalPattern", () =>
      gitIgnorePatternForLiteralPath(String.raw`scratch/[a]*?!#\ file.ts`));

    it("anchors and escapes every character with pattern meaning", ({ literalPattern }) => {
      expect(literalPattern).toBe(String.raw`/scratch/\[a\]\*\?\!\#\\\ file.ts`);
    });
  });

  describe("a repository path containing a line break", () => {
    const it = test.extend("literalPattern", () =>
      gitIgnorePatternForLiteralPath("scratch/line\nbreak.ts"));

    it("does not turn the path into a multi-pattern ignore", ({ literalPattern }) => {
      expect(literalPattern).toBe(null);
    });
  });

  describe.each(["scratch/line\rbreak.ts", "scratch/line\0break.ts"])(
    "a repository path containing a control character",
    (repositoryPath) => {
      const it = test.extend("literalPattern", () =>
        gitIgnorePatternForLiteralPath(repositoryPath));

      it("does not turn the path into an ambiguous ignore pattern", ({ literalPattern }) => {
        expect(literalPattern).toBe(null);
      });
    },
  );

  describe("a concrete repository path with leading and trailing spaces", () => {
    const it = test.extend("literalPattern", () =>
      gitIgnorePatternForLiteralPath(" scratch/guard.ts "));

    it("anchors and escapes both spaces", ({ literalPattern }) => {
      expect(literalPattern).toBe(String.raw`/\ scratch/guard.ts\ `);
    });
  });

  describe("a concrete ignored directory path", () => {
    const it = test.extend("literalPattern", () =>
      gitIgnorePatternForLiteralPath("scratch/generated/"));

    it("preserves the directory suffix", ({ literalPattern }) => {
      expect(literalPattern).toBe("/scratch/generated/");
    });
  });

  describe("ignored paths beside a tracked source reached by the same pattern", () => {
    const it = test.extend("ignoredPaths", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-concrete-ignored-paths-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      mkdirSync(join(repositoryRoot, ".agents"));
      writeFileSync(join(repositoryRoot, ".agents", "config.ts"), "export {};\n");
      gitOutput(["add", ".agents/config.ts"], { cwd: repositoryRoot, env: process.env });
      mkdirSync(join(repositoryRoot, ".git", "info"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".git", "info", "exclude"), ".agents/\n");
      writeFileSync(join(repositoryRoot, ".agents", "scratch.ts"), "export {};\n");
      return gitIgnoredRepositoryPaths(repositoryRoot);
    });

    it("lists only the concrete untracked path", ({ ignoredPaths }) => {
      expect(ignoredPaths).toStrictEqual(new Set([".agents/scratch.ts"]));
    });
  });

  describe("a source under a directory the ignore file names", () => {
    const it = test.extend("ignoredDirectorySourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-ignored-directory-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n");
      mkdirSync(join(repositoryRoot, "dist"));
      writeFileSync(join(repositoryRoot, "dist/status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(join(repositoryRoot, "dist/status.ts"));
    });

    it("is not a repository source", ({ ignoredDirectorySourceAnswer }) => {
      expect(ignoredDirectorySourceAnswer).toBe(true);
    });
  });

  describe("a source whose name matches a suffix pattern in the ignore file", () => {
    const it = test.extend("ignoredSuffixSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-ignored-suffix-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "*.generated.ts\n");
      mkdirSync(join(repositoryRoot, "src"));
      writeFileSync(join(repositoryRoot, "src/status.generated.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(
        join(repositoryRoot, "src/status.generated.ts"),
      );
    });

    it("is not a repository source", ({ ignoredSuffixSourceAnswer }) => {
      expect(ignoredSuffixSourceAnswer).toBe(true);
    });
  });

  describe("a source no pattern in the ignore file reaches", () => {
    const it = test.extend("unmatchedSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-unmatched-source-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n*.generated.ts\n");
      mkdirSync(join(repositoryRoot, "src"));
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(join(repositoryRoot, "src/status.ts"));
    });

    it("stays a repository source", ({ unmatchedSourceAnswer }) => {
      expect(unmatchedSourceAnswer).toBe(false);
    });
  });

  describe("a tracked source that a later ignore pattern would match", () => {
    const it = test.extend("trackedSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-tracked-source-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      mkdirSync(join(repositoryRoot, "dist"));
      writeFileSync(join(repositoryRoot, "dist/status.ts"), "export {};");
      gitOutput(["add", "dist/status.ts"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n");
      return readGitSourceScope(repositoryRoot).isIgnored(join(repositoryRoot, "dist/status.ts"));
    });

    it("stays a repository source", ({ trackedSourceAnswer }) => {
      expect(trackedSourceAnswer).toBe(false);
    });
  });

  describe("a source reached through an ignored symbolic-link ancestor", () => {
    const it = test.extend("linkedAncestorSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-ignored-link-ancestor-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      const externalDirectory = mkdtempSync(join(tmpdir(), "git-ignored-link-target-"));
      writeFileSync(join(repositoryRoot, ".gitignore"), ".local-agents\n");
      writeFileSync(join(externalDirectory, "status.ts"), "export {};");
      symlinkSync(externalDirectory, join(repositoryRoot, ".local-agents"));
      return readGitSourceScope(repositoryRoot).isIgnored(
        join(repositoryRoot, ".local-agents/status.ts"),
      );
    });

    it("is not a repository source", ({ linkedAncestorSourceAnswer }) => {
      expect(linkedAncestorSourceAnswer).toBe(true);
    });
  });

  describe("an ignored source read while the environment names a foreign Git index", () => {
    const it = test.extend("foreignIndexSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-foreign-index-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n");
      mkdirSync(join(repositoryRoot, "dist"));
      writeFileSync(join(repositoryRoot, "dist/status.ts"), "export {};");
      vi.stubEnv("GIT_INDEX_FILE", join(repositoryRoot, "foreign-index"));
      return readGitSourceScope(repositoryRoot).isIgnored(join(repositoryRoot, "dist/status.ts"));
    });

    it("is not a repository source", ({ foreignIndexSourceAnswer }) => {
      expect(foreignIndexSourceAnswer).toBe(true);
    });
  });

  describe("a source outside the repository the scope was built for", () => {
    const it = test.extend("outsideSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-ignored-inside-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "*.ts\n");
      const outsideDirectory = mkdtempSync(join(tmpdir(), "git-ignored-outside-"));
      writeFileSync(join(outsideDirectory, "status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(join(outsideDirectory, "status.ts"));
    });

    it("does not inherit the repository ignores", ({ outsideSourceAnswer }) => {
      expect(outsideSourceAnswer).toBe(false);
    });
  });

  describe("several sources handed to one scope", () => {
    const it = test.extend("ignoredSourcePaths", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-source-scope-filter-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n");
      mkdirSync(join(repositoryRoot, "dist"));
      mkdirSync(join(repositoryRoot, "src"));
      writeFileSync(join(repositoryRoot, "dist/status.ts"), "export {};");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export {};");
      return ["dist/status.ts", "src/status.ts"].filter(
        readGitSourceScope(repositoryRoot).isIgnored,
      );
    });

    it("keeps only the ignored one", ({ ignoredSourcePaths }) => {
      expect(ignoredSourcePaths).toStrictEqual(["dist/status.ts"]);
    });
  });

  describe("a source under a repository root that does not exist", () => {
    const it = test.extend("missingRootSourceAnswer", () => {
      const missingRepositoryRoot = join(tmpdir(), "missing-git-source-scope");
      return readGitSourceScope(missingRepositoryRoot).isIgnored(
        join(missingRepositoryRoot, "dist/status.ts"),
      );
    });

    it("stays a repository source", ({ missingRootSourceAnswer }) => {
      expect(missingRootSourceAnswer).toBe(false);
    });
  });

  describe("a source under a root that no repository encloses", () => {
    const it = test.extend("unenclosedRootSourceAnswer", () => {
      const unenclosedRoot = mkdtempSync(join(tmpdir(), "git-unenclosed-root-"));
      return readGitSourceScope(unenclosedRoot).isIgnored(join(unenclosedRoot, "dist/status.ts"));
    });

    it("stays a repository source", ({ unenclosedRootSourceAnswer }) => {
      expect(unenclosedRootSourceAnswer).toBe(false);
    });
  });

  describe("the Git command behind a scope for a root that no repository encloses", () => {
    const it = test.extend("gitCommandForUnenclosedRoot", () => {
      const unenclosedRoot = mkdtempSync(join(tmpdir(), "git-unenclosed-root-command-"));
      readGitSourceScope(unenclosedRoot).isIgnored(join(unenclosedRoot, "dist/status.ts"));
      return vi.mocked(gitRawOutput);
    });

    it("is never run at all", ({ gitCommandForUnenclosedRoot }) => {
      expect(gitCommandForUnenclosedRoot).not.toHaveBeenCalled();
    });
  });

  describe("a source under a repository link that resolves to nothing", () => {
    const it = test.extend("unresolvableLinkSourceAnswer", () => {
      const unresolvableRoot = mkdtempSync(join(tmpdir(), "git-unresolvable-link-"));
      writeFileSync(join(unresolvableRoot, ".git"), "gitdir: /nonexistent/git-directory\n");
      return readGitSourceScope(unresolvableRoot).isIgnored(
        join(unresolvableRoot, "dist/status.ts"),
      );
    });

    it("stays a repository source", ({ unresolvableLinkSourceAnswer }) => {
      expect(unresolvableLinkSourceAnswer).toBe(false);
    });
  });

  describe("an ignored source read through a symbolic repository root", () => {
    const it = test.extend("symbolicRootSourceAnswer", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "git-symbolic-root-target-"));
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "dist\n");
      mkdirSync(join(repositoryRoot, "dist"));
      writeFileSync(join(repositoryRoot, "dist/status.ts"), "export {};");
      const linkParent = mkdtempSync(join(tmpdir(), "git-symbolic-root-link-"));
      const linkedRoot = join(linkParent, "repository");
      symlinkSync(repositoryRoot, linkedRoot);
      return readGitSourceScope(linkedRoot).isIgnored(join(repositoryRoot, "dist/status.ts"));
    });

    it("is not a repository source", ({ symbolicRootSourceAnswer }) => {
      expect(symbolicRootSourceAnswer).toBe(true);
    });
  });
});
