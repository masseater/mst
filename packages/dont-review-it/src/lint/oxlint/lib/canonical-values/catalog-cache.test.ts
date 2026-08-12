import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

const ENTRY = {
  conceptId: "user.status",
  declarationPath: "src/user.ts",
  exportPath: null,
  values: ["draft", "published"],
  fingerprint: "vocabulary",
};

const UNSERIALIZABLE_CACHE_ROOT = join(tmpdir(), "catalog-cache-unserializable");

const it = test
  .extend("entriesReadBackForTheSameInput", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeCachedEntries(root, { fingerprint: "input", entries: [ENTRY] });
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackForADifferentInput", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeCachedEntries(root, { fingerprint: "other", entries: [ENTRY] });
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackWithoutACache", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackFromTextThatIsNotJson", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
    writeFileSync(join(root, ...CACHE_SEGMENTS), "{ this is not json");
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackFromSomethingOtherThanAnObject", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
    writeFileSync(join(root, ...CACHE_SEGMENTS), JSON.stringify("a catalog"));
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackFromACacheMissingTheNamingFields", ({}, { onCleanup }) => {
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
  })
  .extend("entriesReadBackFromAnOlderFormat", ({}, { onCleanup }) => {
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
  })
  .extend("entriesReadBackWhenTheEntriesAreNotAList", ({}, { onCleanup }) => {
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
  })
  .extend("entriesReadBackWhenAnEntryIsNotAnObject", ({}, { onCleanup }) => {
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
  })
  .extend("entriesReadBackWhenAnEntryMissesAField", ({}, { onCleanup }) => {
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
  })
  .extend("entriesReadBackWhenAConceptIsNotAWord", ({}, { onCleanup }) => {
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
        entries: [{ ...ENTRY, conceptId: 1 }],
      }),
    );
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackWhenAnExportPathIsNeitherAbsentNorAWord", ({}, { onCleanup }) => {
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
        entries: [{ ...ENTRY, exportPath: 1 }],
      }),
    );
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackWhenTheValuesAreNotAList", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
    writeFileSync(
      join(root, ...CACHE_SEGMENTS),
      JSON.stringify({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, values: 1 }] }),
    );
    return readCachedEntries(root, "input");
  })
  .extend("entriesReadBackWhenAValueIsNotASpelling", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(dirname(join(root, ...CACHE_SEGMENTS)), { recursive: true });
    writeFileSync(
      join(root, ...CACHE_SEGMENTS),
      JSON.stringify({ version: 3, fingerprint: "input", entries: [{ ...ENTRY, values: [{}] }] }),
    );
    return readCachedEntries(root, "input");
  })
  .extend("failureFromACacheBlockedByADirectory", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "catalog-cache-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, ...CACHE_SEGMENTS), { recursive: true });
    const [failure] = attempt<unknown, Error>(() => {
      writeCachedEntries(root, { fingerprint: "input", entries: [ENTRY] });
    });
    return failure;
  })
  .extend("failureFromAnEntryThatRefusesToSerialize", ({}, { onCleanup }) => {
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
  })
  .extend("fingerprintOfAFileOfOneByte", () =>
    cacheInputFingerprint([
      { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 1, mtimeMs: 1 },
    ]),
  )
  .extend("fingerprintOfTheSameFileGrownByOneByte", () =>
    cacheInputFingerprint([
      { absolutePath: "/repo/src/user.ts", relativePath: "src/user.ts", size: 2, mtimeMs: 1 },
    ]),
  );

describe("catalog-cache", () => {
  it("a cache written for the same input is read back", ({ entriesReadBackForTheSameInput }) => {
    expect(entriesReadBackForTheSameInput).toStrictEqual([ENTRY]);
  });

  it("a cache written for a different input is not read back", ({
    entriesReadBackForADifferentInput,
  }) => {
    expect(entriesReadBackForADifferentInput).toBe(null);
  });

  it("no cache at all is not read back", ({ entriesReadBackWithoutACache }) => {
    expect(entriesReadBackWithoutACache).toBe(null);
  });

  it("a cache that is not json is not read back", ({ entriesReadBackFromTextThatIsNotJson }) => {
    expect(entriesReadBackFromTextThatIsNotJson).toBe(null);
  });

  it("a cache holding something other than an object is not read back", ({
    entriesReadBackFromSomethingOtherThanAnObject,
  }) => {
    expect(entriesReadBackFromSomethingOtherThanAnObject).toBe(null);
  });

  it("a cache missing the fields that name it is not read back", ({
    entriesReadBackFromACacheMissingTheNamingFields,
  }) => {
    expect(entriesReadBackFromACacheMissingTheNamingFields).toBe(null);
  });

  it("a cache written by an older format is not read back", ({
    entriesReadBackFromAnOlderFormat,
  }) => {
    expect(entriesReadBackFromAnOlderFormat).toBe(null);
  });

  it("a cache whose entries are not a list is not read back", ({
    entriesReadBackWhenTheEntriesAreNotAList,
  }) => {
    expect(entriesReadBackWhenTheEntriesAreNotAList).toBe(null);
  });

  it("a cache holding an entry that is not an object is not read back", ({
    entriesReadBackWhenAnEntryIsNotAnObject,
  }) => {
    expect(entriesReadBackWhenAnEntryIsNotAnObject).toBe(null);
  });

  it("a cache holding an entry that is missing a field is not read back", ({
    entriesReadBackWhenAnEntryMissesAField,
  }) => {
    expect(entriesReadBackWhenAnEntryMissesAField).toBe(null);
  });

  it("a cache holding an entry whose concept is not a word is not read back", ({
    entriesReadBackWhenAConceptIsNotAWord,
  }) => {
    expect(entriesReadBackWhenAConceptIsNotAWord).toBe(null);
  });

  it("a cache holding an entry whose export path is neither absent nor a word is not read back", ({
    entriesReadBackWhenAnExportPathIsNeitherAbsentNorAWord,
  }) => {
    expect(entriesReadBackWhenAnExportPathIsNeitherAbsentNorAWord).toBe(null);
  });

  it("a cache holding an entry whose values are not a list is not read back", ({
    entriesReadBackWhenTheValuesAreNotAList,
  }) => {
    expect(entriesReadBackWhenTheValuesAreNotAList).toBe(null);
  });

  it("a cache holding a value that is not a spelling is not read back", ({
    entriesReadBackWhenAValueIsNotASpelling,
  }) => {
    expect(entriesReadBackWhenAValueIsNotASpelling).toBe(null);
  });

  it("a cache that cannot be written for a reason the runtime named is left unwritten", ({
    failureFromACacheBlockedByADirectory,
  }) => {
    expect(failureFromACacheBlockedByADirectory).toBe(null);
  });

  it("a cache that cannot be written for a reason the runtime did not name is raised", ({
    failureFromAnEntryThatRefusesToSerialize,
  }) => {
    expect(failureFromAnEntryThatRefusesToSerialize).toBe(
      `the derived catalog cache at ${join(UNSERIALIZABLE_CACHE_ROOT, ...CACHE_SEGMENTS)} could not be written`,
    );
  });

  it("the fingerprint of the inputs changes when a file changes", ({
    fingerprintOfAFileOfOneByte,
    fingerprintOfTheSameFileGrownByOneByte,
  }) => {
    expect(fingerprintOfAFileOfOneByte).not.toBe(fingerprintOfTheSameFileGrownByOneByte);
  });
});
