import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("catalog", () => {
  const declarationFor = (conceptId: string, canonicalItems: readonly string[]) => ({
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
    values: canonicalItems,
    fingerprint: fingerprintValues(canonicalItems),
  });

  test("a concept that spells the same value twice is listed against it once", () => {
    const repeated = declarationFor("order-status", ["draft", "draft"]);

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
    const first = declarationFor("order-status", ["draft", "published"]);
    const second = declarationFor("article-status", ["published", "draft"]);

    const catalog = buildCatalog([first, second]);

    expect(catalog.entriesByFingerprint.get(first.fingerprint)).toStrictEqual([first, second]);
  });

  test("a value resolves to every concept that owns it", () => {
    const first = declarationFor("order-status", ["draft"]);
    const second = declarationFor("article-status", ["draft", "archived"]);

    const catalog = buildCatalog([first, second]);

    expect(catalog.entriesByValue.get(canonicalValueKey("draft"))).toStrictEqual([first, second]);
    expect(catalog.entriesByValue.get(canonicalValueKey("archived"))).toStrictEqual([second]);
  });

  test("a value nobody declares resolves to nothing", () => {
    const catalog = buildCatalog([declarationFor("order-status", ["draft"])]);

    expect(catalog.entriesByValue.get(canonicalValueKey("published"))).toBeUndefined();
  });
});
