import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";

const it = test
  .extend("emptyCatalog", () => EMPTY_CANONICAL_VALUES_CATALOG)
  .extend("entriesResolvedForARepeatedValue", () => {
    const repeated = {
      conceptId: "order-status",
      declarationPath: "packages/example/src/order-status.ts",
      exportPath: "@mst/example",
      values: ["draft", "draft"],
      fingerprint: "fingerprint-of-draft",
    };
    return buildCatalog([repeated]).entriesByValue.get(canonicalValueKey("draft"));
  })
  .extend("entriesResolvedForASharedFingerprint", () => {
    const orderStatus = {
      conceptId: "order-status",
      declarationPath: "packages/example/src/order-status.ts",
      exportPath: "@mst/example",
      values: ["draft", "published"],
      fingerprint: "fingerprint-of-draft-and-published",
    };
    const articleStatus = {
      conceptId: "article-status",
      declarationPath: "packages/example/src/article-status.ts",
      exportPath: "@mst/example",
      values: ["published", "draft"],
      fingerprint: "fingerprint-of-draft-and-published",
    };
    return buildCatalog([orderStatus, articleStatus]).entriesByFingerprint.get(
      "fingerprint-of-draft-and-published",
    );
  })
  .extend("entriesResolvedForAValueTwoConceptsOwn", () => {
    const orderStatus = {
      conceptId: "order-status",
      declarationPath: "packages/example/src/order-status.ts",
      exportPath: "@mst/example",
      values: ["draft"],
      fingerprint: "fingerprint-of-draft",
    };
    const articleStatus = {
      conceptId: "article-status",
      declarationPath: "packages/example/src/article-status.ts",
      exportPath: "@mst/example",
      values: ["draft", "archived"],
      fingerprint: "fingerprint-of-draft-and-archived",
    };
    return buildCatalog([orderStatus, articleStatus]).entriesByValue.get(
      canonicalValueKey("draft"),
    );
  })
  .extend("entriesResolvedForAValueOneConceptOwns", () => {
    const orderStatus = {
      conceptId: "order-status",
      declarationPath: "packages/example/src/order-status.ts",
      exportPath: "@mst/example",
      values: ["draft"],
      fingerprint: "fingerprint-of-draft",
    };
    const articleStatus = {
      conceptId: "article-status",
      declarationPath: "packages/example/src/article-status.ts",
      exportPath: "@mst/example",
      values: ["draft", "archived"],
      fingerprint: "fingerprint-of-draft-and-archived",
    };
    return buildCatalog([orderStatus, articleStatus]).entriesByValue.get(
      canonicalValueKey("archived"),
    );
  })
  .extend("entriesResolvedForAValueNobodyDeclares", () => {
    const orderStatus = {
      conceptId: "order-status",
      declarationPath: "packages/example/src/order-status.ts",
      exportPath: "@mst/example",
      values: ["draft"],
      fingerprint: "fingerprint-of-draft",
    };
    return buildCatalog([orderStatus]).entriesByValue.get(canonicalValueKey("published"));
  });

describe("catalog", () => {
  it("a concept that spells the same value twice is listed against it once", ({
    entriesResolvedForARepeatedValue,
  }) => {
    expect(entriesResolvedForARepeatedValue).toStrictEqual([
      {
        conceptId: "order-status",
        declarationPath: "packages/example/src/order-status.ts",
        exportPath: "@mst/example",
        values: ["draft", "draft"],
        fingerprint: "fingerprint-of-draft",
      },
    ]);
  });

  it("an empty catalog holds no entry and resolves no value", ({ emptyCatalog }) => {
    expect(emptyCatalog).toStrictEqual({
      entries: [],
      entriesByFingerprint: new Map(),
      entriesByValue: new Map(),
    });
  });

  it("concepts that share a value set are reachable through one fingerprint", ({
    entriesResolvedForASharedFingerprint,
  }) => {
    expect(entriesResolvedForASharedFingerprint).toStrictEqual([
      {
        conceptId: "order-status",
        declarationPath: "packages/example/src/order-status.ts",
        exportPath: "@mst/example",
        values: ["draft", "published"],
        fingerprint: "fingerprint-of-draft-and-published",
      },
      {
        conceptId: "article-status",
        declarationPath: "packages/example/src/article-status.ts",
        exportPath: "@mst/example",
        values: ["published", "draft"],
        fingerprint: "fingerprint-of-draft-and-published",
      },
    ]);
  });

  it("a value resolves to every concept that owns it", ({
    entriesResolvedForAValueTwoConceptsOwn,
  }) => {
    expect(entriesResolvedForAValueTwoConceptsOwn).toStrictEqual([
      {
        conceptId: "order-status",
        declarationPath: "packages/example/src/order-status.ts",
        exportPath: "@mst/example",
        values: ["draft"],
        fingerprint: "fingerprint-of-draft",
      },
      {
        conceptId: "article-status",
        declarationPath: "packages/example/src/article-status.ts",
        exportPath: "@mst/example",
        values: ["draft", "archived"],
        fingerprint: "fingerprint-of-draft-and-archived",
      },
    ]);
  });

  it("a value only one concept owns resolves to that concept alone", ({
    entriesResolvedForAValueOneConceptOwns,
  }) => {
    expect(entriesResolvedForAValueOneConceptOwns).toStrictEqual([
      {
        conceptId: "article-status",
        declarationPath: "packages/example/src/article-status.ts",
        exportPath: "@mst/example",
        values: ["draft", "archived"],
        fingerprint: "fingerprint-of-draft-and-archived",
      },
    ]);
  });

  it("a value nobody declares resolves to nothing", ({
    entriesResolvedForAValueNobodyDeclares,
  }) => {
    expect(entriesResolvedForAValueNobodyDeclares).toBe(undefined);
  });
});
