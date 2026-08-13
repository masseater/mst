import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

const USER_STATUS_CATALOG_ENTRY = {
  conceptId: "user.status",
  declarationPath: "src/user.ts",
  exportPath: null,
  values: ["draft", "published"],
  fingerprint: "vocabulary",
};

const UNSERIALIZABLE_CACHE_ROOT = join(tmpdir(), "catalog-cache-unserializable");

describe("readCachedEntries", () => {
  describe("a cache written for the same input", () => {
    const it = test.extend("catalogReadBackForTheSameInput", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeCachedEntries(root, { fingerprint: "input", entries: [USER_STATUS_CATALOG_ENTRY] });
      return readCachedEntries(root, "input");
    });

    it("is read back", ({ catalogReadBackForTheSameInput }) => {
      expect(catalogReadBackForTheSameInput).toStrictEqual([USER_STATUS_CATALOG_ENTRY]);
    });
  });

  describe("a cache written for a different input", () => {
    const it = test.extend("catalogReadBackForADifferentInput", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeCachedEntries(root, { fingerprint: "other", entries: [USER_STATUS_CATALOG_ENTRY] });
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackForADifferentInput }) => {
      expect(catalogReadBackForADifferentInput).toBe(null);
    });
  });

  describe("no cache at all", () => {
    const it = test.extend("catalogReadBackWithoutACache", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackWithoutACache }) => {
      expect(catalogReadBackWithoutACache).toBe(null);
    });
  });

  describe("a cache that is not json", () => {
    const it = test.extend("catalogReadBackFromANonJsonCache", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(join(root, ...CACHE_SEGMENTS), "{ this is not json");
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromANonJsonCache }) => {
      expect(catalogReadBackFromANonJsonCache).toBe(null);
    });
  });

  describe("a cache holding something other than an object", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingASpelling", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(join(root, ...CACHE_SEGMENTS), JSON.stringify("a catalog"));
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingASpelling }) => {
      expect(catalogReadBackFromACacheHoldingASpelling).toBe(null);
    });
  });

  describe("a cache missing the fields that name it", () => {
    const it = test.extend("catalogReadBackFromACacheWithoutItsNamingFields", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({ fingerprint: "input", entries: [] }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheWithoutItsNamingFields }) => {
      expect(catalogReadBackFromACacheWithoutItsNamingFields).toBe(null);
    });
  });

  describe("a cache written by an older format", () => {
    const it = test.extend("catalogReadBackFromAnOlderFormatCache", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({ version: 1, fingerprint: "input", entries: [] }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromAnOlderFormatCache }) => {
      expect(catalogReadBackFromAnOlderFormatCache).toBe(null);
    });
  });

  describe("a cache whose entries are not a list", () => {
    const it = test.extend("catalogReadBackFromACacheWhoseEntriesAreASpelling", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({ version: 3, fingerprint: "input", entries: "none" }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheWhoseEntriesAreASpelling }) => {
      expect(catalogReadBackFromACacheWhoseEntriesAreASpelling).toBe(null);
    });
  });

  describe("a cache holding an entry that is not an object", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingANullEntry", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({ version: 3, fingerprint: "input", entries: [null] }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingANullEntry }) => {
      expect(catalogReadBackFromACacheHoldingANullEntry).toBe(null);
    });
  });

  describe("a cache holding an entry that is missing a field", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingAnEntryWithoutAFingerprint", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({
          version: 3,
          fingerprint: "input",
          entries: [
            {
              conceptId: "user.status",
              declarationPath: "src/user.ts",
              exportPath: null,
              values: ["draft", "published"],
            },
          ],
        }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingAnEntryWithoutAFingerprint }) => {
      expect(catalogReadBackFromACacheHoldingAnEntryWithoutAFingerprint).toBe(null);
    });
  });

  describe("a cache holding an entry whose concept is not a word", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingANumberForAConceptId", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({
          version: 3,
          fingerprint: "input",
          entries: [{ ...USER_STATUS_CATALOG_ENTRY, conceptId: 1 }],
        }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingANumberForAConceptId }) => {
      expect(catalogReadBackFromACacheHoldingANumberForAConceptId).toBe(null);
    });
  });

  describe("a cache holding an entry whose export path is neither absent nor a word", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingANumberForAnExportPath", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({
          version: 3,
          fingerprint: "input",
          entries: [{ ...USER_STATUS_CATALOG_ENTRY, exportPath: 1 }],
        }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingANumberForAnExportPath }) => {
      expect(catalogReadBackFromACacheHoldingANumberForAnExportPath).toBe(null);
    });
  });

  describe("a cache holding an entry whose values are not a list", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingANumberForTheCanonicalValues", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({
          version: 3,
          fingerprint: "input",
          entries: [{ ...USER_STATUS_CATALOG_ENTRY, values: 1 }],
        }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingANumberForTheCanonicalValues }) => {
      expect(catalogReadBackFromACacheHoldingANumberForTheCanonicalValues).toBe(null);
    });
  });

  describe("a cache holding a value that is not a spelling", () => {
    const it = test.extend("catalogReadBackFromACacheHoldingAnObjectAsACanonicalValue", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
      writeFileSync(
        join(root, ...CACHE_SEGMENTS),
        JSON.stringify({
          version: 3,
          fingerprint: "input",
          entries: [{ ...USER_STATUS_CATALOG_ENTRY, values: [{}] }],
        }),
      );
      return readCachedEntries(root, "input");
    });

    it("is not read back", ({ catalogReadBackFromACacheHoldingAnObjectAsACanonicalValue }) => {
      expect(catalogReadBackFromACacheHoldingAnObjectAsACanonicalValue).toBe(null);
    });
  });
});

describe("writeCachedEntries", () => {
  describe("a cache that cannot be written for a reason the runtime named", () => {
    const it = test.extend("failure", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, ...CACHE_SEGMENTS), { recursive: true });
      const [failure] = attempt<unknown, Error>(() => {
        writeCachedEntries(root, { fingerprint: "input", entries: [USER_STATUS_CATALOG_ENTRY] });
      });
      return failure;
    });

    it("is left unwritten", ({ failure }) => {
      expect(failure).toBe(null);
    });
  });

  describe("a cache that cannot be written for a reason the runtime did not name", () => {
    const it = test.extend("failureMessage", ({}, { onCleanup }) => {
      rmSync(UNSERIALIZABLE_CACHE_ROOT, { recursive: true, force: true });
      mkdirSync(UNSERIALIZABLE_CACHE_ROOT, { recursive: true });
      onCleanup(() => {
        rmSync(UNSERIALIZABLE_CACHE_ROOT, { recursive: true, force: true });
      });
      const refusingEntry = {
        conceptId: "user.status",
        declarationPath: "src/user.ts",
        exportPath: null,
        values: ["draft", "published"],
        fingerprint: "vocabulary",
        toJSON: () => {
          throw new TypeError("this entry refuses to be written");
        },
      };
      const [failure] = attempt<unknown, Error>(() => {
        writeCachedEntries(UNSERIALIZABLE_CACHE_ROOT, {
          fingerprint: "input",
          entries: [refusingEntry],
        });
      });
      return failure === null ? null : failure.message;
    });

    it("is raised", ({ failureMessage }) => {
      expect(failureMessage).toBe(
        `the derived catalog cache at ${join(UNSERIALIZABLE_CACHE_ROOT, ...CACHE_SEGMENTS)} could not be written`,
      );
    });
  });
});

describe("cacheInputFingerprint", () => {
  describe("the same file grown by one byte", () => {
    const it = test
      .extend("fingerprintOfAFileOfOneByte", () =>
        cacheInputFingerprint([
          { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 1, mtimeMs: 1 },
        ]))
      .extend("fingerprintOfTheSameFileGrownByOneByte", () =>
        cacheInputFingerprint([
          { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 2, mtimeMs: 1 },
        ]),
      );

    it("changes the fingerprint of the inputs", ({
      fingerprintOfAFileOfOneByte,
      fingerprintOfTheSameFileGrownByOneByte,
    }) => {
      expect(fingerprintOfAFileOfOneByte).not.toBe(fingerprintOfTheSameFileGrownByOneByte);
    });
  });
});
