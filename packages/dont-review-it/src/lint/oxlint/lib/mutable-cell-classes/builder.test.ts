import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryCellClassIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const TALLY = `class Tally {
  total = 0;
  add(row: number) {
    this.total += row;
  }
}

const sum = (rows: readonly number[]): number => {
  const tally = new Tally();
  for (const row of rows) tally.add(row);
  return tally.total;
};

export const total = sum([1, 2]);
`;

describe("loadRepositoryCellClassIndex", () => {
  describe("a source holding a class standing in for a local variable", () => {
    const it = test.extend("cellClassIndex", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), TALLY, "utf8");
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it("is found at its own path", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/a.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
        ]),
      });
    });
  });

  describe("a repository whose sources are all out of scope", () => {
    const it = test.extend("cellClassIndex", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.test.ts"), TALLY, "utf8");
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it("is indexed as empty", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
    });
  });

  describe("a repository holding no source at all", () => {
    const it = test.extend("cellClassIndex", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "notes.md"), "nothing to read\n", "utf8");
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it("is indexed as empty", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
    });
  });

  describe("a source that vanished after the listing", () => {
    const it = test.extend("cellClassIndex", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "vanished.ts"), TALLY, "utf8");
      vi.mocked(readTextFile).mockReturnValueOnce(null);
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it("is left out of the index", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
    });
  });

  describe("the index of a repository", () => {
    const it = test.extend("sameIndexOnASecondAsk", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), TALLY, "utf8");
      return (
        loadRepositoryCellClassIndex({ repositoryRoot: root }) ===
        loadRepositoryCellClassIndex({ repositoryRoot: root })
      );
    });

    it("is built once and handed back on every later ask", ({ sameIndexOnASecondAsk }) => {
      expect(sameIndexOnASecondAsk).toBe(true);
    });
  });
});
