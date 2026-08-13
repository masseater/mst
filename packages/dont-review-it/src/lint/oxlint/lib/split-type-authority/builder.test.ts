import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryTypeAuthorityIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const SHAPE =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };\n";

describe("loadRepositoryTypeAuthorityIndex", () => {
  describe("a repository holding one source that declares an exported type", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it("places that source in the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/a.ts"]);
    });
  });

  describe("a repository holding a source that declares no exported type", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
      writeFileSync(join(root, "src", "b.ts"), "export {};\n", "utf8");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it("leaves that source out of the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/a.ts"]);
    });
  });

  describe("a repository holding only a test file", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.test.ts"), SHAPE, "utf8");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it("leaves the test file out of the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual([]);
    });
  });

  describe("a repository holding no source at all", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "README.md"), "# held\n", "utf8");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it("is indexed as empty", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual([]);
    });
  });

  describe("a repository holding a source that cannot be read", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a-unreadable.ts"), SHAPE, "utf8");
      writeFileSync(join(root, "src", "b-present.ts"), SHAPE, "utf8");
      vi.mocked(readTextFile).mockReturnValueOnce(null);
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it("leaves that source out of the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/b-present.ts"]);
    });
  });

  describe("a type standing beside a manifest", () => {
    const it = test.extend("workspacePaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "order", "src"), { recursive: true });
      writeFileSync(join(root, "packages", "order", "package.json"), "{}", "utf8");
      writeFileSync(join(root, "packages", "order", "src", "a.ts"), SHAPE, "utf8");
      return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
        .typesByPath.get("packages/order/src/a.ts")
        ?.map((indexed) => indexed.workspacePath);
    });

    it("is placed in the workspace whose manifest stands nearest to it", ({ workspacePaths }) => {
      expect(workspacePaths).toStrictEqual(["packages/order"]);
    });
  });

  describe("a type standing under no manifest at all", () => {
    const it = test.extend("workspacePaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
      return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
        .typesByPath.get("src/a.ts")
        ?.map((indexed) => indexed.workspacePath);
    });

    it("belongs to the repository root", ({ workspacePaths }) => {
      expect(workspacePaths).toStrictEqual([""]);
    });
  });

  describe("a repository asked for its index a second time", () => {
    const it = test.extend("sameIndexHandedBack", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
      return (
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }) ===
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
      );
    });

    it("is handed the index built on the first ask", ({ sameIndexHandedBack }) => {
      expect(sameIndexHandedBack).toBe(true);
    });
  });
});
