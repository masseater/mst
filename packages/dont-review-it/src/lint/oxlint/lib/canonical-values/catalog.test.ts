import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("catalog", () => {
  const entry = (conceptId: string, values: readonly string[]) => ({
    annotationStart: 0,
    binding: "VALUES",
    bindingStart: 20,
    conceptId,
    declarationEnd: 40,
    declarationPath: `packages/example/src/${conceptId}.ts`,
    declarationStart: 10,
    importRoutes: [
      {
        exportName: "VALUES",
        resolvedSourcePaths: ["packages/example/src/index.ts"],
        specifier: "@mst/example",
      },
    ],
    packageName: "@mst/example",
    values,
    fingerprint: fingerprintValues(values),
  });

  test("a concept that spells the same value twice is listed against it once", () => {
    const repeated = entry("order-status", ["draft", "draft"]);

    expect(buildCatalog([repeated]).entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([
      repeated,
    ]);
  });

  test("repository package identity does not depend on a valid owner entry", () => {
    expect(buildCatalog([], { packageNames: ["@mst/example"] }).packageNames).toStrictEqual(
      new Set(["@mst/example"]),
    );
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

  test("a value nobody declares resolves to nothing", () => {
    const catalog = buildCatalog([entry("order-status", ["draft"])]);

    expect(catalog.entriesByValue.get(canonicalValueKey("published"))).toBeUndefined();
  });
});
