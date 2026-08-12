import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("catalog", () => {
  const listed = (conceptId: string, heldValues: readonly string[]) => ({
    conceptId,
    declarationPath: `packages/example/src/${conceptId}.ts`,
    exportPath: "@mst/example",
    values: heldValues,
    fingerprint: fingerprintValues(heldValues),
  });

  test("a concept that spells the same value twice is listed against it once", () => {
    const repeated = listed("order-status", ["draft", "draft"]);

    expect(buildCatalog([repeated]).entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([
      repeated,
    ]);
  });

  test("an empty catalog resolves nothing", () => {
    expect(EMPTY_CANONICAL_VALUES_CATALOG.entries).toStrictEqual([]);
    expect(EMPTY_CANONICAL_VALUES_CATALOG.entriesByValue.size).toBe(0);
  });

  test("concepts that share a value set are reachable through one fingerprint", () => {
    const first = listed("order-status", ["draft", "published"]);
    const second = listed("article-status", ["published", "draft"]);

    const catalog = buildCatalog([first, second]);

    expect(catalog.entriesByFingerprint.get(first.fingerprint)).toStrictEqual([first, second]);
  });

  test("a value resolves to every concept that owns it", () => {
    const first = listed("order-status", ["draft"]);
    const second = listed("article-status", ["draft", "archived"]);

    const catalog = buildCatalog([first, second]);

    expect(catalog.entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([first, second]);
    expect(catalog.entriesByValue.get(canonicalValueKey("archived"))).toStrictEqual([second]);
  });

  test("a value nobody declares resolves to nothing", () => {
    const catalog = buildCatalog([listed("order-status", ["draft"])]);

    expect(catalog.entriesByValue.get(canonicalValueKey("published"))).toBeUndefined();
  });
});
