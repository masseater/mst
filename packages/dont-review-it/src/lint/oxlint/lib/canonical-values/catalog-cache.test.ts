import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { fingerprintValues } from "./fingerprint.ts";

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

const ORDER_STATUS_CATALOG_ENTRY = {
  annotationStart: 0,
  binding: "VALUES",
  bindingStart: 2,
  conceptId: "order.status",
  declarationEnd: 3,
  declarationPath: "src/status.ts",
  declarationStart: 1,
  fingerprint: fingerprintValues(["draft"]),
  importRoutes: [
    {
      exportName: "VALUES",
      resolvedSourcePaths: ["src/index.ts"],
      specifier: "@fixture/vocabulary",
    },
  ],
  packageName: null,
  values: ["draft"],
};

describe("readCachedEntries", () => {
  describe("a current cache sealed for its own repository fingerprint", () => {
    const it = test.extend("catalogReadBackForItsOwnFingerprint", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      const cacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      const integrity = createHash("sha256").update(JSON.stringify(cacheDocument)).digest("hex");
      writeFileSync(cachePath, JSON.stringify({ ...cacheDocument, integrity }), "utf8");
      return readCachedEntries(root, "repository-fingerprint");
    });

    it("is read back", ({ catalogReadBackForItsOwnFingerprint }) => {
      expect(catalogReadBackForItsOwnFingerprint).toStrictEqual([ORDER_STATUS_CATALOG_ENTRY]);
    });
  });

  describe("a current cache read under a repository fingerprint that is not its own", () => {
    const it = test.extend("catalogReadBackForAForeignFingerprint", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      const cacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      const integrity = createHash("sha256").update(JSON.stringify(cacheDocument)).digest("hex");
      writeFileSync(cachePath, JSON.stringify({ ...cacheDocument, integrity }), "utf8");
      return readCachedEntries(root, "foreign-fingerprint");
    });

    it("is not read back under another fingerprint", ({
      catalogReadBackForAForeignFingerprint,
    }) => {
      expect(catalogReadBackForAForeignFingerprint).toBe(null);
    });
  });

  describe("a cache the reader cannot parse", () => {
    const it = test.extend("catalogReadBackFromAnUnreadableCache", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "{ this is not json", "utf8");
      return readCachedEntries(root, "repository-fingerprint");
    });

    it("is treated as a cache miss", ({ catalogReadBackFromAnUnreadableCache }) => {
      expect(catalogReadBackFromAnUnreadableCache).toBe(null);
    });
  });

  describe("cache envelopes that are not the current sealed shape", () => {
    const it = test.extend("catalogsReadBackFromRejectedEnvelopes", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      const currentCacheDocument = {
        version: 5,
        fingerprint: "repository-fingerprint",
        entries: [ORDER_STATUS_CATALOG_ENTRY],
      };
      const sealedCacheDocument = {
        ...currentCacheDocument,
        integrity: createHash("sha256").update(JSON.stringify(currentCacheDocument)).digest("hex"),
      };
      return [
        null,
        "cache",
        {},
        { ...sealedCacheDocument, version: 4 },
        { ...sealedCacheDocument, fingerprint: 1 },
        { ...sealedCacheDocument, integrity: 1 },
        { ...sealedCacheDocument, entries: "entries" },
        { ...sealedCacheDocument, integrity: "forged" },
      ].map((cacheDocument) => {
        writeFileSync(cachePath, JSON.stringify(cacheDocument), "utf8");
        return readCachedEntries(root, "repository-fingerprint");
      });
    });

    it("are each rejected", ({ catalogsReadBackFromRejectedEnvelopes }) => {
      expect(catalogsReadBackFromRejectedEnvelopes).toStrictEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    });
  });

  describe("entries whose identity or declaration offsets are broken", () => {
    const it = test.extend("catalogsReadBackFromBrokenIdentities", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      return [
        null,
        "an entry",
        {},
        { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: 0.5 },
        { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 0.5 },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationEnd: 0.5 },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationStart: 0.5 },
        { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: -1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationStart: -1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, annotationStart: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 0 },
        { ...ORDER_STATUS_CATALOG_ENTRY, bindingStart: 3 },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationEnd: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, binding: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, binding: "" },
        { ...ORDER_STATUS_CATALOG_ENTRY, conceptId: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, conceptId: "Order Status" },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationPath: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, declarationPath: "" },
        { ...ORDER_STATUS_CATALOG_ENTRY, fingerprint: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, fingerprint: "not-a-fingerprint" },
        { ...ORDER_STATUS_CATALOG_ENTRY, packageName: 1 },
        { ...ORDER_STATUS_CATALOG_ENTRY, packageName: "" },
      ].map((candidateEntry) => {
        const cacheDocument = {
          version: 5,
          fingerprint: "repository-fingerprint",
          entries: [candidateEntry],
        };
        const integrity = createHash("sha256").update(JSON.stringify(cacheDocument)).digest("hex");
        writeFileSync(cachePath, JSON.stringify({ ...cacheDocument, integrity }), "utf8");
        return readCachedEntries(root, "repository-fingerprint");
      });
    });

    it("are each rejected", ({ catalogsReadBackFromBrokenIdentities }) => {
      expect(catalogsReadBackFromBrokenIdentities).toStrictEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    });
  });

  describe("entries whose import routes are broken", () => {
    const it = test.extend("catalogsReadBackFromBrokenImportRoutes", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      const declaredRoute = ORDER_STATUS_CATALOG_ENTRY.importRoutes[0];
      return [
        { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: null },
        { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [null] },
        { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{}] },
        { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{ ...declaredRoute, exportName: "" }] },
        { ...ORDER_STATUS_CATALOG_ENTRY, importRoutes: [{ ...declaredRoute, specifier: "" }] },
        {
          ...ORDER_STATUS_CATALOG_ENTRY,
          importRoutes: [{ exportName: "VALUES", specifier: "@fixture/vocabulary" }],
        },
        {
          ...ORDER_STATUS_CATALOG_ENTRY,
          importRoutes: [{ ...declaredRoute, resolvedSourcePaths: "src/index.ts" }],
        },
        {
          ...ORDER_STATUS_CATALOG_ENTRY,
          importRoutes: [{ ...declaredRoute, resolvedSourcePaths: [] }],
        },
        ...[
          "",
          ".",
          "src\0index.ts",
          "src\\index.ts",
          "src/../index.ts",
          "../index.ts",
          "/src/index.ts",
          "C:/src/index.ts",
        ].map((sourcePath) => ({
          ...ORDER_STATUS_CATALOG_ENTRY,
          importRoutes: [{ ...declaredRoute, resolvedSourcePaths: [sourcePath] }],
        })),
        {
          ...ORDER_STATUS_CATALOG_ENTRY,
          importRoutes: [
            { ...declaredRoute, resolvedSourcePaths: ["src/index.ts", "src/index.ts"] },
          ],
        },
      ].map((candidateEntry) => {
        const cacheDocument = {
          version: 5,
          fingerprint: "repository-fingerprint",
          entries: [candidateEntry],
        };
        const integrity = createHash("sha256").update(JSON.stringify(cacheDocument)).digest("hex");
        writeFileSync(cachePath, JSON.stringify({ ...cacheDocument, integrity }), "utf8");
        return readCachedEntries(root, "repository-fingerprint");
      });
    });

    it("are each rejected", ({ catalogsReadBackFromBrokenImportRoutes }) => {
      expect(catalogsReadBackFromBrokenImportRoutes).toStrictEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    });
  });

  describe("entries whose canonical domain is broken", () => {
    const it = test.extend("catalogsReadBackFromBrokenCanonicalDomains", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const cachePath = join(root, ...CACHE_SEGMENTS);
      mkdirSync(dirname(cachePath), { recursive: true });
      return [
        { ...ORDER_STATUS_CATALOG_ENTRY, values: null },
        { ...ORDER_STATUS_CATALOG_ENTRY, values: [] },
        { ...ORDER_STATUS_CATALOG_ENTRY, values: [{}] },
        { ...ORDER_STATUS_CATALOG_ENTRY, values: ["draft", "draft"] },
        {
          ...ORDER_STATUS_CATALOG_ENTRY,
          values: ["draft"],
          fingerprint: fingerprintValues(["other"]),
        },
      ].map((candidateEntry) => {
        const cacheDocument = {
          version: 5,
          fingerprint: "repository-fingerprint",
          entries: [candidateEntry],
        };
        const integrity = createHash("sha256").update(JSON.stringify(cacheDocument)).digest("hex");
        writeFileSync(cachePath, JSON.stringify({ ...cacheDocument, integrity }), "utf8");
        return readCachedEntries(root, "repository-fingerprint");
      });
    });

    it("are each rejected", ({ catalogsReadBackFromBrokenCanonicalDomains }) => {
      expect(catalogsReadBackFromBrokenCanonicalDomains).toStrictEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
    });
  });
});

describe("writeCachedEntries", () => {
  describe("a repository root the file system refuses to hold a cache under", () => {
    const it = test.extend("failure", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const occupiedRoot = join(root, "not-a-directory");
      writeFileSync(occupiedRoot, "occupied", "utf8");
      const [failure] = attempt<unknown, Error>(() => {
        writeCachedEntries(occupiedRoot, { fingerprint: "repository-fingerprint", entries: [] });
      });
      return failure;
    });

    it("is left unwritten without raising", ({ failure }) => {
      expect(failure).toBe(null);
    });
  });
});
