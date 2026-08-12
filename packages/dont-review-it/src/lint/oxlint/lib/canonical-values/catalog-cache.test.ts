import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { createCanonicalValuesTestRepository } from "./canonical-values.test-fixture.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("catalog cache", () => {
  const cachePathOf = (repositoryRoot: string): string =>
    join(repositoryRoot, "node_modules", ".cache", "mst-dont-review-it", "canonical-values.json");

  const cacheIntegrity = (fingerprint: string, catalogEntries: readonly unknown[]): string =>
    createHash("sha256")
      .update(JSON.stringify({ version: 5, fingerprint, entries: catalogEntries }))
      .digest("hex");

  const validEntry = {
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

  const writeCachePayload = (repositoryRoot: string, cacheDocument: unknown): void => {
    const path = cachePathOf(repositoryRoot);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cacheDocument), "utf8");
  };

  const validCacheDocument = (
    catalogEntries: readonly unknown[] = [validEntry],
    fingerprint = "repository-fingerprint",
  ) => ({
    entries: catalogEntries,
    fingerprint,
    integrity: cacheIntegrity(fingerprint, catalogEntries),
    version: 5,
  });

  const readCacheDocument = (cacheDocument: unknown, fingerprint = "repository-fingerprint") => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCachePayload(repositoryRoot, cacheDocument);
    return readCachedEntries(repositoryRoot, fingerprint);
  };

  test("a valid current payload is read only for its own repository fingerprint", () => {
    const cacheDocument = validCacheDocument();

    expect(readCacheDocument(cacheDocument)).toStrictEqual([validEntry]);
    expect(readCacheDocument(cacheDocument, "other-fingerprint")).toBe(null);
  });

  test("an unreadable cache is treated as a cache miss", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const path = cachePathOf(repositoryRoot);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{not json", "utf8");

    expect(readCachedEntries(repositoryRoot, "repository-fingerprint")).toBe(null);
  });

  test.each([
    null,
    "cache",
    {},
    { ...validCacheDocument(), version: 4 },
    { ...validCacheDocument(), fingerprint: 1 },
    { ...validCacheDocument(), integrity: 1 },
    { ...validCacheDocument(), entries: "entries" },
    { ...validCacheDocument(), integrity: "forged" },
  ])("an invalid cache envelope is rejected", (cacheDocument) => {
    expect(readCacheDocument(cacheDocument)).toBe(null);
  });

  test.each([
    null,
    "entry",
    {},
    { ...validEntry, annotationStart: 0.5 },
    { ...validEntry, bindingStart: 0.5 },
    { ...validEntry, declarationEnd: 0.5 },
    { ...validEntry, declarationStart: 0.5 },
    { ...validEntry, annotationStart: -1 },
    { ...validEntry, declarationStart: -1 },
    { ...validEntry, annotationStart: 1 },
    { ...validEntry, bindingStart: 0 },
    { ...validEntry, bindingStart: 3 },
    { ...validEntry, declarationEnd: 1 },
    { ...validEntry, binding: 1 },
    { ...validEntry, binding: "" },
    { ...validEntry, conceptId: 1 },
    { ...validEntry, conceptId: "Order Status" },
    { ...validEntry, declarationPath: 1 },
    { ...validEntry, declarationPath: "" },
    { ...validEntry, fingerprint: 1 },
    { ...validEntry, fingerprint: "not-a-fingerprint" },
    { ...validEntry, packageName: 1 },
    { ...validEntry, packageName: "" },
  ])("an entry with invalid identity or offsets is rejected", (candidateEntry) => {
    expect(readCacheDocument(validCacheDocument([candidateEntry]))).toBe(null);
  });

  test.each([
    { ...validEntry, importRoutes: null },
    { ...validEntry, importRoutes: [null] },
    { ...validEntry, importRoutes: [{}] },
    { ...validEntry, importRoutes: [{ ...validEntry.importRoutes[0], exportName: "" }] },
    { ...validEntry, importRoutes: [{ ...validEntry.importRoutes[0], specifier: "" }] },
    {
      ...validEntry,
      importRoutes: [{ exportName: "VALUES", specifier: "@fixture/vocabulary" }],
    },
    {
      ...validEntry,
      importRoutes: [{ ...validEntry.importRoutes[0], resolvedSourcePaths: "src/index.ts" }],
    },
    {
      ...validEntry,
      importRoutes: [{ ...validEntry.importRoutes[0], resolvedSourcePaths: [] }],
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
    ].map((path) => ({
      ...validEntry,
      importRoutes: [{ ...validEntry.importRoutes[0], resolvedSourcePaths: [path] }],
    })),
    {
      ...validEntry,
      importRoutes: [
        { ...validEntry.importRoutes[0], resolvedSourcePaths: ["src/index.ts", "src/index.ts"] },
      ],
    },
  ])("an entry with an invalid import route is rejected", (candidateEntry) => {
    expect(readCacheDocument(validCacheDocument([candidateEntry]))).toBe(null);
  });

  test.each([
    { ...validEntry, values: null },
    { ...validEntry, values: [] },
    { ...validEntry, values: [{}] },
    { ...validEntry, values: ["draft", "draft"] },
    { ...validEntry, values: ["draft"], fingerprint: fingerprintValues(["other"]) },
  ])("an entry with an invalid canonical domain is rejected", (candidateEntry) => {
    expect(readCacheDocument(validCacheDocument([candidateEntry]))).toBe(null);
  });

  test("cache input problems participate in the fingerprint", () => {
    expect(
      cacheInputFingerprint(
        [],
        [{ filePath: "src/link.ts", kind: "unsafe-symbolic-link", line: 1 }],
      ),
    ).not.toBe(cacheInputFingerprint([]));
  });

  test("a cache write failure caused by the file system is non-fatal", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const fileRoot = join(repositoryRoot, "not-a-directory");
    writeFileSync(fileRoot, "occupied");

    expect(() => {
      writeCachedEntries(fileRoot, {
        entries: [],
        fingerprint: "repository-fingerprint",
      });
    }).not.toThrow();
  });
});
