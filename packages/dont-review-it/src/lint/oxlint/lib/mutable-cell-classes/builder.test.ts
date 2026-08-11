import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildRepositoryCellClassIndex, loadRepositoryCellClassIndex } from "./builder.ts";

const VANISHED_FILE_NAME = "vanished.ts";

class MissingPathError extends Error {
  readonly code = "ENOENT";

  constructor() {
    super("the path is gone");
  }
}

vi.mock(import("node:fs"), async (importOriginal) => {
  const real = await importOriginal();
  const readFileSync = ((...call: Parameters<typeof real.readFileSync>) => {
    const [path] = call;
    if (String(path).endsWith(VANISHED_FILE_NAME)) throw new MissingPathError();
    return real.readFileSync(...call);
  }) as typeof real.readFileSync;
  return { ...real, readFileSync };
});

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

describe("buildRepositoryCellClassIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "mutable-cell-classes-builder-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return root;
  };

  const findingsIn = (repositoryRoot: string, relativePath: string) =>
    buildRepositoryCellClassIndex({ repositoryRoot }).findingsByPath.get(relativePath) ?? [];

  test("a class standing in for a local variable is found at its own path", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": TALLY });

    expect(findingsIn(repositoryRoot, "src/a.ts")).toStrictEqual([
      { className: "Tally", fields: ["total"], scopeName: "sum" },
    ]);
  });

  test("a repository whose sources are all out of scope is indexed as empty", () => {
    const repositoryRoot = repositoryWith({ "src/a.test.ts": TALLY });

    expect(findingsIn(repositoryRoot, "src/a.test.ts")).toStrictEqual([]);
  });

  test("a repository holding no source at all is indexed as empty", () => {
    const repositoryRoot = repositoryWith({ "notes.md": "nothing to read\n" });

    expect(findingsIn(repositoryRoot, "notes.md")).toStrictEqual([]);
  });

  test("a source that vanished after the listing is left out of the index", () => {
    const repositoryRoot = repositoryWith({ [`src/${VANISHED_FILE_NAME}`]: TALLY });

    expect(findingsIn(repositoryRoot, `src/${VANISHED_FILE_NAME}`)).toStrictEqual([]);
  });

  test("the index of a repository is built once and handed back on every later ask", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": TALLY });

    expect(loadRepositoryCellClassIndex({ repositoryRoot })).toBe(
      loadRepositoryCellClassIndex({ repositoryRoot }),
    );
  });
});
