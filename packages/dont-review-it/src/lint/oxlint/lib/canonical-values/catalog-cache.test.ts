import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";

const UNWRITABLE_MARKER = "refuse-to-write";

vi.mock(import("node:fs"), async (importOriginal) => {
  const real = await importOriginal();
  const writeFileSync = (...call: Parameters<typeof real.writeFileSync>) => {
    const [path] = call;
    if (String(path).includes(UNWRITABLE_MARKER)) throw new Error("the write was refused");
    real.writeFileSync(...call);
  };
  return { ...real, writeFileSync };
});

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

const ENTRY = {
  conceptId: "user.status",
  declarationPath: "src/user.ts",
  exportPath: null,
  values: ["draft", "published"],
  fingerprint: "vocabulary",
};

describe("catalog-cache", () => {
  const repository = (): string => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  };

  const withCache = (text: string): string => {
    const root = repository();
    const path = join(root, ...CACHE_SEGMENTS);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
    return root;
  };

  const cached = (payload: unknown): string => withCache(JSON.stringify(payload));

  const entriesFrom = (root: string): unknown => readCachedEntries(root, "input");

  test("a cache written for the same input is read back", () => {
    const root = repository();
    writeCachedEntries(root, { fingerprint: "input", entries: [ENTRY] });

    expect(entriesFrom(root)).toStrictEqual([ENTRY]);
  });

  test("a cache written for a different input is not read back", () => {
    const root = repository();
    writeCachedEntries(root, { fingerprint: "other", entries: [ENTRY] });

    expect(entriesFrom(root)).toBe(null);
  });

  test("no cache at all is not read back", () => {
    expect(entriesFrom(repository())).toBe(null);
  });

  test("a cache that is not json is not read back", () => {
    expect(entriesFrom(withCache("{ this is not json"))).toBe(null);
  });

  test("a cache holding something other than an object is not read back", () => {
    expect(entriesFrom(cached("a catalog"))).toBe(null);
  });

  test("a cache missing the fields that name it is not read back", () => {
    expect(entriesFrom(cached({ fingerprint: "input", entries: [] }))).toBe(null);
  });

  test("a cache written by an older format is not read back", () => {
    expect(entriesFrom(cached({ version: 1, fingerprint: "input", entries: [] }))).toBe(null);
  });

  test("a cache whose entries are not a list is not read back", () => {
    expect(entriesFrom(cached({ version: 3, fingerprint: "input", entries: "none" }))).toBe(null);
  });

  test("a cache holding an entry that is not an object is not read back", () => {
    expect(entriesFrom(cached({ version: 3, fingerprint: "input", entries: [null] }))).toBe(null);
  });

  test("a cache holding an entry that is missing a field is not read back", () => {
    const { fingerprint, ...withoutFingerprint } = ENTRY;

    expect(
      entriesFrom(cached({ version: 3, fingerprint: "input", entries: [withoutFingerprint] })),
    ).toBe(null);
  });

  test("a cache holding an entry whose concept is not a word is not read back", () => {
    expect(
      entriesFrom(
        cached({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, conceptId: 1 }] }),
      ),
    ).toBe(null);
  });

  test("a cache holding an entry whose export path is neither absent nor a word is not read back", () => {
    expect(
      entriesFrom(
        cached({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, exportPath: 1 }] }),
      ),
    ).toBe(null);
  });

  test("a cache holding an entry whose values are not a list is not read back", () => {
    expect(
      entriesFrom(cached({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, values: 1 }] })),
    ).toBe(null);
  });

  test("a cache holding a value that is not a spelling is not read back", () => {
    expect(
      entriesFrom(
        cached({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, values: [{}] }] }),
      ),
    ).toBe(null);
  });

  test("a cache that cannot be written for a reason the runtime named is left unwritten", () => {
    const root = repository();
    const path = join(root, ...CACHE_SEGMENTS);
    mkdirSync(path, { recursive: true });

    expect(() => {
      writeCachedEntries(root, { fingerprint: "input", entries: [ENTRY] });
    }).not.toThrow();
  });

  test("a cache that cannot be written for a reason the runtime did not name is raised", () => {
    const root = join(repository(), UNWRITABLE_MARKER);

    expect(() => {
      writeCachedEntries(root, { fingerprint: "input", entries: [ENTRY] });
    }).toThrow("could not be written");
  });

  test("the fingerprint of the inputs changes when a file changes", () => {
    const before = cacheInputFingerprint([
      { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 1, mtimeMs: 1 },
    ]);
    const after = cacheInputFingerprint([
      { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 2, mtimeMs: 1 },
    ]);

    expect(before).not.toBe(after);
  });
});
