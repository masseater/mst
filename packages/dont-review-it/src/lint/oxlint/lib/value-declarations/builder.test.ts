import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { loadRepositoryValueDeclarationIndex } from "./builder.ts";

const REMOVED_FILE_NAME = "removed.ts";

class GonePathError extends Error {
  readonly code = "ENOENT";

  constructor() {
    super("the file is no longer there");
  }
}

vi.mock(import("node:fs"), async (importOriginal) => {
  const real = await importOriginal();
  const readFileSync = ((...call: Parameters<typeof real.readFileSync>) => {
    const [path] = call;
    if (String(path).endsWith(REMOVED_FILE_NAME)) throw new GonePathError();
    return real.readFileSync(...call);
  }) as typeof real.readFileSync;
  return { ...real, readFileSync };
});

const SEED = `export const seed = 1;\n`;

describe("loadRepositoryValueDeclarationIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    }
    return root;
  };

  const pathsIn = (repositoryRoot: string): readonly string[] => [
    ...loadRepositoryValueDeclarationIndex({ repositoryRoot }).sitesByPath.keys(),
  ];

  test("takes in every source that declares a value", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED, "src/b.ts": SEED });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  test("leaves a test file out of the index", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED, "src/a.test.ts": SEED });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts"]);
  });

  test("leaves a source that declares no value of its own out of the index", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED, "src/b.ts": "export {};\n" });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts"]);
  });

  test("leaves a source that went away after the listing out of the index", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED, [`src/${REMOVED_FILE_NAME}`]: SEED });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts"]);
  });

  test("names the two places a copied value stands", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED, "src/b.ts": SEED });
    const index = loadRepositoryValueDeclarationIndex({ repositoryRoot });

    expect(index.sitesByName.get("seed")?.map((site) => site.relativePath)).toStrictEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  test("builds the index of a repository once and hands the same one back later", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SEED });

    expect(loadRepositoryValueDeclarationIndex({ repositoryRoot })).toBe(
      loadRepositoryValueDeclarationIndex({ repositoryRoot }),
    );
  });
});
