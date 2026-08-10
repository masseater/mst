import { execFileSync } from "node:child_process";
import { chmodSync, symlinkSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import { range } from "es-toolkit";
import { describe, expect, it } from "vite-plus/test";

import { compareRevisions } from "./repository-comparison.ts";
import { withTestRepository } from "./test-repository.ts";

const renameSource = (prefix: string, changed = false): string =>
  `${range(30)
    .map((index) => `export const ${prefix}${index} = ${changed && index === 0 ? 99 : index};`)
    .join("\n")}\n`;

describe("compareRevisions", () => {
  it("returns an empty comparison for identical revisions", async () => {
    await withTestRepository(async (repository) => {
      const revision = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: revision,
          headRevision: revision,
        }),
      ).resolves.toStrictEqual({
        repositoryRoot: repository.root,
        baseRevision: revision,
        headRevision: revision,
        files: [],
      });
    });
  });

  it("classifies added, deleted, changed, and renamed files", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/changed.tsx": "export const Changed = () => <div />;\n",
          "src/deleted.js": "export const deleted = true;\n",
          "assets/renamed.bin": "\0renamed\0",
        },
      });
      const head = repository.commit({
        files: {
          "src/added.ts": "export const added = true;\n",
          "src/changed.tsx": "export const Changed = () => <div />;\nexport const next = true;\n",
          "assets/current.bin": "\0renamed\0",
        },
        removed: ["src/deleted.js", "assets/renamed.bin"],
      });

      const comparison = await compareRevisions({
        repositoryRoot: repository.root,
        baseRevision: base,
        headRevision: head,
      });

      expect(comparison.repositoryRoot).toBe(repository.root);
      expect(comparison.baseRevision).toBe(base);
      expect(comparison.headRevision).toBe(head);
      expect(comparison.files).toHaveLength(4);
      expect(comparison.files.find(({ kind }) => kind === "added")).toStrictEqual({
        kind: "added",
        beforePath: null,
        afterPath: "src/added.ts",
        beforeSource: null,
        afterSource: "export const added = true;\n",
        addedLines: [1],
        firstAddedLine: 1,
      });
      expect(comparison.files.find(({ kind }) => kind === "deleted")).toStrictEqual({
        kind: "deleted",
        beforePath: "src/deleted.js",
        afterPath: null,
        beforeSource: "export const deleted = true;\n",
        afterSource: null,
        addedLines: [],
        firstAddedLine: null,
      });
      expect(comparison.files.find(({ kind }) => kind === "changed")).toStrictEqual({
        kind: "changed",
        beforePath: "src/changed.tsx",
        afterPath: "src/changed.tsx",
        beforeSource: "export const Changed = () => <div />;\n",
        afterSource: "export const Changed = () => <div />;\nexport const next = true;\n",
        addedLines: [2],
        firstAddedLine: 2,
      });
      expect(comparison.files.find(({ kind }) => kind === "renamed")).toStrictEqual({
        kind: "renamed",
        beforePath: "assets/renamed.bin",
        afterPath: "assets/current.bin",
        beforeSource: null,
        afterSource: null,
        addedLines: [],
        firstAddedLine: null,
      });
    });
  });

  it("preserves paths containing spaces and reads their complete blobs", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/with space.mjs": "export const value = 1;\n" },
      });
      const head = repository.commit({
        files: { "src/with space.mjs": "export const value = 2;\n" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
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

  it("preserves a path containing spaces when only its mode changes", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/with space.ts": "export const value = 1;\n" },
      });
      chmodSync(resolve(repository.root, "src/with space.ts"), 0o755);
      const head = repository.commit({});

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
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

  it("preserves a path containing a tab and reads its complete blobs", async () => {
    await withTestRepository(async (repository) => {
      const path = "src/with\ttab.ts";
      const base = repository.commit({
        files: { [path]: "export const value = 1;\n" },
      });
      const head = repository.commit({
        files: { [path]: "export const value = 2;\n" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
        files: [
          {
            kind: "changed",
            beforePath: path,
            afterPath: path,
            beforeSource: "export const value = 1;\n",
            afterSource: "export const value = 2;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  it("rejects a NUL-bearing source-extension blob", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      const head = repository.commit({
        files: { "src/binary.ts": "\0binary\0" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).rejects.toThrow("Source blob contains NUL bytes: src/binary.ts");
    });
  });

  it("classifies a regular file changed to a symbolic link as changed", async () => {
    await withTestRepository(async (repository) => {
      const path = "src/current.ts";
      const base = repository.commit({
        files: { [path]: "export const current = true;\n" },
      });
      unlinkSync(resolve(repository.root, path));
      symlinkSync("target.ts", resolve(repository.root, path));
      const head = repository.commit({});

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
        files: [
          {
            kind: "changed",
            beforePath: path,
            afterPath: path,
            beforeSource: "export const current = true;\n",
            afterSource: "target.ts",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  it("uses standard diff prefixes regardless of repository configuration", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "b/legacy.ts": "export const value = 1;\n" },
      });
      execFileSync("git", ["config", "diff.noprefix", "true"], { cwd: repository.root });
      const head = repository.commit({
        files: { "b/legacy.ts": "export const value = 2;\n" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
        files: [
          {
            kind: "changed",
            beforePath: "b/legacy.ts",
            afterPath: "b/legacy.ts",
          },
        ],
      });
    });
  });

  it("detects multiple inexact renames regardless of the repository rename limit", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/a.ts": renameSource("a"),
          "src/b.ts": renameSource("b"),
        },
      });
      execFileSync("git", ["config", "diff.renameLimit", "1"], { cwd: repository.root });
      const head = repository.commit({
        files: {
          "src/current-a.ts": renameSource("a", true),
          "src/current-b.ts": renameSource("b", true),
        },
        removed: ["src/a.ts", "src/b.ts"],
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: base,
          headRevision: head,
        }),
      ).resolves.toMatchObject({
        files: [
          {
            kind: "renamed",
            beforePath: "src/a.ts",
            afterPath: "src/current-a.ts",
          },
          {
            kind: "renamed",
            beforePath: "src/b.ts",
            afterPath: "src/current-b.ts",
          },
        ],
      });
    });
  });

  it("rejects an invalid revision", async () => {
    await withTestRepository(async (repository) => {
      const head = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });

      await expect(
        compareRevisions({
          repositoryRoot: repository.root,
          baseRevision: "missing-revision",
          headRevision: head,
        }),
      ).rejects.toThrow("Command failed");
    });
  });
});
