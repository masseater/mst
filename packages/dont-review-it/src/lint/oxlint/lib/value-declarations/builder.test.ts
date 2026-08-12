import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryValueDeclarationIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const SEED = `export const seed = 1;\n`;

const REMOVED_FILE_NAME = "removed.ts";

const SEED_FINGERPRINT = '{annotation:null,init:{type:"Literal",value:1,raw:"1"}}';

const it = test
  .extend("indexOfTwoSourcesDeclaringValues", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
    writeFileSync(join(repositoryRoot, "src", "b.ts"), SEED, "utf8");
    return loadRepositoryValueDeclarationIndex({ repositoryRoot });
  })
  .extend("indexOfASourceBesideATestFile", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
    writeFileSync(join(repositoryRoot, "src", "a.test.ts"), SEED, "utf8");
    return loadRepositoryValueDeclarationIndex({ repositoryRoot });
  })
  .extend("indexOfASourceBesideAValuelessSource", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
    writeFileSync(join(repositoryRoot, "src", "b.ts"), "export {};\n", "utf8");
    return loadRepositoryValueDeclarationIndex({ repositoryRoot });
  })
  .extend("indexOfASourceBesideAVanishedSource", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
    writeFileSync(join(repositoryRoot, "src", REMOVED_FILE_NAME), SEED, "utf8");
    vi.mocked(readTextFile).mockImplementation((path) =>
      path.endsWith(REMOVED_FILE_NAME) ? null : readFileSync(path, "utf8"),
    );
    return loadRepositoryValueDeclarationIndex({ repositoryRoot });
  })
  .extend("repositoryRootHoldingOneSource", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    const target = join(repositoryRoot, "src", "a.ts");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, SEED, "utf8");
    return repositoryRoot;
  })
  .extend("indexBuiltFirst", ({ repositoryRootHoldingOneSource }) =>
    loadRepositoryValueDeclarationIndex({ repositoryRoot: repositoryRootHoldingOneSource }),
  )
  .extend("indexBuiltAgain", ({ repositoryRootHoldingOneSource }) =>
    loadRepositoryValueDeclarationIndex({ repositoryRoot: repositoryRootHoldingOneSource }),
  );

describe("loadRepositoryValueDeclarationIndex", () => {
  it("takes in every source that declares a value", ({ indexOfTwoSourcesDeclaringValues }) => {
    expect(indexOfTwoSourcesDeclaringValues).toStrictEqual({
      sitesByName: new Map([
        [
          "seed",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/b.ts",
            },
          ],
        ],
      ]),
      sitesByPath: new Map([
        [
          "src/a.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
        [
          "src/b.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/b.ts",
            },
          ],
        ],
      ]),
    });
  });

  it("leaves a test file out of the index", ({ indexOfASourceBesideATestFile }) => {
    expect(indexOfASourceBesideATestFile).toStrictEqual({
      sitesByName: new Map([
        [
          "seed",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
      sitesByPath: new Map([
        [
          "src/a.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
    });
  });

  it("leaves a source that declares no value of its own out of the index", ({
    indexOfASourceBesideAValuelessSource,
  }) => {
    expect(indexOfASourceBesideAValuelessSource).toStrictEqual({
      sitesByName: new Map([
        [
          "seed",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
      sitesByPath: new Map([
        [
          "src/a.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
    });
  });

  it("leaves a source that went away after the listing out of the index", ({
    indexOfASourceBesideAVanishedSource,
  }) => {
    expect(indexOfASourceBesideAVanishedSource).toStrictEqual({
      sitesByName: new Map([
        [
          "seed",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
      sitesByPath: new Map([
        [
          "src/a.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
      ]),
    });
  });

  it("names the two places a copied value stands", ({ indexOfTwoSourcesDeclaringValues }) => {
    expect(indexOfTwoSourcesDeclaringValues).toStrictEqual({
      sitesByName: new Map([
        [
          "seed",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/b.ts",
            },
          ],
        ],
      ]),
      sitesByPath: new Map([
        [
          "src/a.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/a.ts",
            },
          ],
        ],
        [
          "src/b.ts",
          [
            {
              name: "seed",
              line: 1,
              exported: true,
              fingerprint: SEED_FINGERPRINT,
              relativePath: "src/b.ts",
            },
          ],
        ],
      ]),
    });
  });

  it("builds the index of a repository once and hands the same one back later", ({
    indexBuiltAgain,
    indexBuiltFirst,
  }) => {
    expect(indexBuiltAgain).toBe(indexBuiltFirst);
  });
});
