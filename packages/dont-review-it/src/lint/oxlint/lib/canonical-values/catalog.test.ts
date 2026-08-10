import { expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";

const entry = (conceptId: string, values: readonly string[]) => ({
  conceptId,
  declarationPath: `packages/example/src/${conceptId}.ts`,
  exportPath: "@mst/example",
  values,
  fingerprint: fingerprintValues(values),
});

test("an empty catalog resolves nothing", () => {
  expect(EMPTY_CANONICAL_VALUES_CATALOG.entries).toStrictEqual([]);
  expect(EMPTY_CANONICAL_VALUES_CATALOG.entriesByValue.size).toBe(0);
});

test("concepts that share a value set are reachable through one fingerprint", () => {
  const first = entry("order-status", ["draft", "published"]);
  const second = entry("article-status", ["published", "draft"]);

  const catalog = buildCatalog([first, second]);

  expect(catalog.entriesByFingerprint.get(first.fingerprint)).toStrictEqual([first, second]);
});

test("a value resolves to every concept that owns it", () => {
  const first = entry("order-status", ["draft"]);
  const second = entry("article-status", ["draft", "archived"]);

  const catalog = buildCatalog([first, second]);

  expect(catalog.entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([first, second]);
  expect(catalog.entriesByValue.get(canonicalValueKey("archived"))).toStrictEqual([second]);
});

test("a concept that spells the same value twice is listed against it once", () => {
  const repeated = entry("order-status", ["draft", "draft"]);

  const catalog = buildCatalog([repeated]);

  expect(catalog.entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([repeated]);
});

test("a value nobody declares resolves to nothing", () => {
  const catalog = buildCatalog([entry("order-status", ["draft"])]);

  expect(catalog.entriesByValue.get(canonicalValueKey("published"))).toBeUndefined();
});
