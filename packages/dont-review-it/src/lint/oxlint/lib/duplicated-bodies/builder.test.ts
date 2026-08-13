import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { buildRepositoryBodyIndex, loadRepositoryBodyIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const VANISHED_FILE_NAME = "vanished.ts";

const TWICE = `export const twice = (value: number): number => {
  const doubled = value * 2;
  return doubled;
};
`;

describe("buildRepositoryBodyIndex", () => {
  describe("a body spelled in two files of a repository", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
      writeFileSync(join(repositoryRoot, "src", "b.ts"), TWICE, "utf8");
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it("places both of those files in the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/a.ts", "src/b.ts"]);
    });
  });

  describe("a repository whose sources are all out of scope", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.test.ts"), TWICE, "utf8");
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it("is indexed as empty", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual([]);
    });
  });

  describe("a repository holding a source that declares no body of its own", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
      writeFileSync(join(repositoryRoot, "src", "b.ts"), "export {};\n", "utf8");
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it("leaves that source out of the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/a.ts"]);
    });
  });

  describe("a repository holding a source that vanished after the listing", () => {
    const it = test.extend("indexedPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
      writeFileSync(join(repositoryRoot, "src", VANISHED_FILE_NAME), TWICE, "utf8");
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(VANISHED_FILE_NAME) ? null : readFileSync(path, "utf8"),
      );
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it("leaves that source out of the index", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["src/a.ts"]);
    });
  });
});

describe("loadRepositoryBodyIndex", () => {
  describe("a repository asked for its index a second time", () => {
    const it = test.extend("sameIndexHandedBack", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
      writeFileSync(join(repositoryRoot, "src", "b.ts"), TWICE, "utf8");
      return (
        loadRepositoryBodyIndex({ repositoryRoot }) === loadRepositoryBodyIndex({ repositoryRoot })
      );
    });

    it("is handed the index built on the first ask", ({ sameIndexHandedBack }) => {
      expect(sameIndexHandedBack).toBe(true);
    });
  });
});
