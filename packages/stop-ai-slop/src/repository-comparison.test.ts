import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { compareRevisions, decodedSource } from "./repository-comparison.ts";

const GIT_ENVIRONMENT = {
  GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
  GIT_AUTHOR_NAME: "Stop AI Slop",
  GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
  GIT_COMMITTER_NAME: "Stop AI Slop",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  PATH: process.env.PATH,
};

describe("compareRevisions", () => {
  describe("a base and a head naming the same revision", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD",
          headRevision: "HEAD",
        });
      });

    it("carries no file between the two", ({ comparison, repositoryRoot }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD",
        headRevision: "HEAD",
        files: [],
      });
    });
  });

  describe("a head that adds, deletes, changes, and renames a file at once", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/changed.tsx", "export const Changed = () => <div />;\n");
        writeSource("src/deleted.js", "export const deleted = true;\n");
        writeSource("assets/renamed.bin", "\0renamed\0");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/added.ts", "export const added = true;\n");
        writeSource(
          "src/changed.tsx",
          "export const Changed = () => <div />;\nexport const next = true;\n",
        );
        writeSource("assets/current.bin", "\0renamed\0");
        unlinkSync(join(repositoryRoot, "src/deleted.js"));
        unlinkSync(join(repositoryRoot, "assets/renamed.bin"));
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("names every file with the change it carries", ({ comparison, repositoryRoot }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "renamed",
            beforePath: "assets/renamed.bin",
            afterPath: "assets/current.bin",
            beforeSource: null,
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/added.ts",
            beforeSource: null,
            afterSource: "export const added = true;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "changed",
            beforePath: "src/changed.tsx",
            afterPath: "src/changed.tsx",
            beforeSource: "export const Changed = () => <div />;\n",
            afterSource: "export const Changed = () => <div />;\nexport const next = true;\n",
            addedLines: [2],
            firstAddedLine: 2,
          },
          {
            kind: "deleted",
            beforePath: "src/deleted.js",
            afterPath: null,
            beforeSource: "export const deleted = true;\n",
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
        ],
      });
    });
  });

  describe("a changed file whose path carries a space", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/with space.mjs", "export const value = 1;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/with space.mjs", "export const value = 2;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("keeps the space in the path and reads both blobs whole", ({
      comparison,
      repositoryRoot,
    }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/with space.mjs",
            afterPath: "src/with space.mjs",
            beforeSource: "export const value = 1;\n",
            afterSource: "export const value = 2;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a file whose path carries a space and whose mode alone changes", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/with space.ts", "export const value = 1;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        chmodSync(join(repositoryRoot, "src/with space.ts"), 0o755);
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("keeps the space in the path and reports no added line", ({
      comparison,
      repositoryRoot,
    }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/with space.ts",
            afterPath: "src/with space.ts",
            beforeSource: "export const value = 1;\n",
            afterSource: "export const value = 1;\n",
            addedLines: [],
            firstAddedLine: null,
          },
        ],
      });
    });
  });

  describe("a changed file whose path carries a tab", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/with\ttab.ts", "export const value = 1;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/with\ttab.ts", "export const value = 2;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("keeps the tab in the path and reads both blobs whole", ({ comparison, repositoryRoot }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/with\ttab.ts",
            afterPath: "src/with\ttab.ts",
            beforeSource: "export const value = 1;\n",
            afterSource: "export const value = 2;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a head whose source carries a NUL", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/current.ts", 'export const separator = "\0";\n');
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("reads the NUL as a character of the source", ({ comparison, repositoryRoot }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/current.ts",
            afterPath: "src/current.ts",
            beforeSource: "export const current = true;\n",
            afterSource: 'export const separator = "\0";\n',
            addedLines: [],
            firstAddedLine: null,
          },
        ],
      });
    });
  });

  describe("a regular file the head replaced with a symbolic link", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        unlinkSync(join(repositoryRoot, "src/current.ts"));
        symlinkSync("target.ts", join(repositoryRoot, "src/current.ts"));
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("calls the file changed and reads the link target as its source", ({
      comparison,
      repositoryRoot,
    }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/current.ts",
            afterPath: "src/current.ts",
            beforeSource: "export const current = true;\n",
            afterSource: "target.ts",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a repository configured to write diffs without the standard prefixes", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("b/legacy.ts", "export const value = 1;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        runGit(["config", "diff.noprefix", "true"]);
        writeSource("b/legacy.ts", "export const value = 2;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("asks for the standard prefixes and reads the path whole", ({
      comparison,
      repositoryRoot,
    }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "b/legacy.ts",
            afterPath: "b/legacy.ts",
            beforeSource: "export const value = 1;\n",
            afterSource: "export const value = 2;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a repository whose rename limit is lower than the number of renamed pairs", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/a.ts",
          "export const alpha = 1;\nexport const beta = 2;\nexport const gamma = 3;\n",
        );
        writeSource(
          "src/b.ts",
          "export const delta = 4;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
        );
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        runGit(["config", "diff.renameLimit", "1"]);
        writeSource(
          "src/current-a.ts",
          "export const alpha = 9;\nexport const beta = 2;\nexport const gamma = 3;\n",
        );
        writeSource(
          "src/current-b.ts",
          "export const delta = 9;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
        );
        unlinkSync(join(repositoryRoot, "src/a.ts"));
        unlinkSync(join(repositoryRoot, "src/b.ts"));
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("lifts the limit and pairs both renames", ({ comparison, repositoryRoot }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "renamed",
            beforePath: "src/a.ts",
            afterPath: "src/current-a.ts",
            beforeSource:
              "export const alpha = 1;\nexport const beta = 2;\nexport const gamma = 3;\n",
            afterSource:
              "export const alpha = 9;\nexport const beta = 2;\nexport const gamma = 3;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "renamed",
            beforePath: "src/b.ts",
            afterPath: "src/current-b.ts",
            beforeSource:
              "export const delta = 4;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
            afterSource:
              "export const delta = 9;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a caller whose environment names a different repository", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("comparison", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/current.ts", "export const current = false;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        vi.stubEnv("GIT_DIR", join(repositoryRoot, "absent.git"));
        vi.stubEnv("GIT_WORK_TREE", join(repositoryRoot, "absent"));
        return compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        });
      });

    it("reads the repository it was named rather than the one the environment names", ({
      comparison,
      repositoryRoot,
    }) => {
      expect(comparison).toStrictEqual({
        repositoryRoot,
        baseRevision: "HEAD~1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/current.ts",
            afterPath: "src/current.ts",
            beforeSource: "export const current = true;\n",
            afterSource: "export const current = false;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a base revision the repository does not carry", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "repository-comparison-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("missingRevisionRefusal", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        try {
          await compareRevisions({
            repositoryRoot,
            baseRevision: "missing-revision",
            headRevision: "HEAD",
          });
        } catch (refusal) {
          return refusal instanceof Error ? refusal.message : null;
        }
        throw new Error("compareRevisions accepted a revision the repository does not carry");
      });

    it("refuses the comparison with the failed command", ({ missingRevisionRefusal }) => {
      expect(missingRevisionRefusal).toBe(
        "Command failed: git rev-parse --verify --end-of-options missing-revision^{commit}\nfatal: Needed a single revision\n",
      );
    });
  });
});

describe("decodedSource", () => {
  describe("a blob with a source extension that does not decode as UTF-8", () => {
    const it = test.extend("undecodableRefusal", () => {
      const [refusal] = attempt<string, Error>(() =>
        decodedSource("src/binary.ts", Uint8Array.from([0xff, 0xfe, 0xff])),
      );
      return refusal;
    });

    it("refuses the blob and names its path", ({ undecodableRefusal }) => {
      expect(undecodableRefusal).toStrictEqual(
        new Error("Source blob does not decode as UTF-8: src/binary.ts"),
      );
    });
  });
});
