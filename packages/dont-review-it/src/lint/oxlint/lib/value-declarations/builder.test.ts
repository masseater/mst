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

describe("loadRepositoryValueDeclarationIndex", () => {
  describe("a repository holding two sources that declare the same value", () => {
    const it = test.extend("indexOfTwoSourcesDeclaringValues", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
      writeFileSync(join(repositoryRoot, "src", "b.ts"), SEED, "utf8");
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
    });

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
  });

  describe("a repository holding a source beside a test file", () => {
    const it = test.extend("indexOfASourceBesideATestFile", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
      writeFileSync(join(repositoryRoot, "src", "a.test.ts"), SEED, "utf8");
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
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
  });

  describe("a repository holding a source that declares no value of its own", () => {
    const it = test.extend("indexOfASourceBesideAValuelessSource", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
      writeFileSync(join(repositoryRoot, "src", "b.ts"), "export {};\n", "utf8");
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
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
  });

  describe("a repository holding a source that went away after the listing", () => {
    const it = test.extend("indexOfASourceBesideAVanishedSource", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), SEED, "utf8");
      writeFileSync(join(repositoryRoot, "src", REMOVED_FILE_NAME), SEED, "utf8");
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a listed source is still there by the time it is read is settled inside the boundary this spec replaces, and both the listing and the read happen inside one synchronous call
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(REMOVED_FILE_NAME) ? null : readFileSync(path, "utf8"),
      );
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
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
  });

  describe("a repository asked for its index a second time", () => {
    const it = test
      .extend("repositoryRootHoldingOneSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "value-declarations-builder-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const sourceFilePath = join(repositoryRoot, "src", "a.ts");
        mkdirSync(dirname(sourceFilePath), { recursive: true });
        writeFileSync(sourceFilePath, SEED, "utf8");
        return repositoryRoot;
      })
      .extend("indexBuiltFirst", ({ repositoryRootHoldingOneSource }) =>
        loadRepositoryValueDeclarationIndex({ repositoryRoot: repositoryRootHoldingOneSource }),
      )
      .extend("indexBuiltAgain", ({ repositoryRootHoldingOneSource }) =>
        loadRepositoryValueDeclarationIndex({ repositoryRoot: repositoryRootHoldingOneSource }),
      );

    it("builds the index of a repository once and hands the same one back later", ({
      indexBuiltAgain,
      indexBuiltFirst,
    }) => {
      expect(indexBuiltAgain).toBe(indexBuiltFirst);
    });
  });
});
