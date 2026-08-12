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

const it = test
  .extend("indexOfASourceHoldingAClassStandingInForALocalVariable", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), TALLY, "utf8");
    return loadRepositoryCellClassIndex({ repositoryRoot: root });
  })
  .extend("indexOfARepositoryWhoseSourcesAreAllOutOfScope", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.test.ts"), TALLY, "utf8");
    return loadRepositoryCellClassIndex({ repositoryRoot: root });
  })
  .extend("indexOfARepositoryHoldingNoSourceAtAll", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "notes.md"), "nothing to read\n", "utf8");
    return loadRepositoryCellClassIndex({ repositoryRoot: root });
  })
  .extend("indexOfARepositoryWhoseSourceVanishedAfterTheListing", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "vanished.ts"), TALLY, "utf8");
    vi.mocked(readTextFile).mockReturnValueOnce(null);
    return loadRepositoryCellClassIndex({ repositoryRoot: root });
  })
  .extend("sameIndexOnASecondAsk", ({}, { onCleanup }) => {
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

describe("loadRepositoryCellClassIndex", () => {
  it("a class standing in for a local variable is found at its own path", ({
    indexOfASourceHoldingAClassStandingInForALocalVariable,
  }) => {
    expect(indexOfASourceHoldingAClassStandingInForALocalVariable).toStrictEqual({
      findingsByPath: new Map([
        ["src/a.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
      ]),
    });
  });

  it("a repository whose sources are all out of scope is indexed as empty", ({
    indexOfARepositoryWhoseSourcesAreAllOutOfScope,
  }) => {
    expect(indexOfARepositoryWhoseSourcesAreAllOutOfScope).toStrictEqual({
      findingsByPath: new Map(),
    });
  });

  it("a repository holding no source at all is indexed as empty", ({
    indexOfARepositoryHoldingNoSourceAtAll,
  }) => {
    expect(indexOfARepositoryHoldingNoSourceAtAll).toStrictEqual({ findingsByPath: new Map() });
  });

  it("a source that vanished after the listing is left out of the index", ({
    indexOfARepositoryWhoseSourceVanishedAfterTheListing,
  }) => {
    expect(indexOfARepositoryWhoseSourceVanishedAfterTheListing).toStrictEqual({
      findingsByPath: new Map(),
    });
  });

  it("the index of a repository is built once and handed back on every later ask", ({
    sameIndexOnASecondAsk,
  }) => {
    expect(sameIndexOnASecondAsk).toBe(true);
  });
});
