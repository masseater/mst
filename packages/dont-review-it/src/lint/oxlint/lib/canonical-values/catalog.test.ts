import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";

describe("buildCatalog", () => {
  describe("a concept that spells the same value twice", () => {
    const it = test.extend("entriesResolvedForARepeatedValue", () => {
      const repeated = {
        conceptId: "order-status",
        declarationPath: "packages/example/src/order-status.ts",
        exportPath: "@mst/example",
        values: ["draft", "draft"],
        fingerprint: "fingerprint-of-draft",
      };
      return buildCatalog([repeated]).entriesByValue.get(canonicalValueKey("draft"));
    });

    it("is listed against that value once", ({ entriesResolvedForARepeatedValue }) => {
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
  });

  describe("concepts that share a value set", () => {
    const it = test.extend("entriesResolvedForASharedFingerprint", () => {
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
    });

    it("are reachable through one fingerprint", ({ entriesResolvedForASharedFingerprint }) => {
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
  });

  describe("a value two concepts own", () => {
    const it = test.extend("entriesResolvedForAValueTwoConceptsOwn", () => {
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
    });

    it("resolves to every concept that owns it", ({ entriesResolvedForAValueTwoConceptsOwn }) => {
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
  });

  describe("a value only one concept owns", () => {
    const it = test.extend("entriesResolvedForAValueOneConceptOwns", () => {
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
    });

    it("resolves to that concept alone", ({ entriesResolvedForAValueOneConceptOwns }) => {
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
  });

  describe("a value nobody declares", () => {
    const it = test.extend("entriesResolvedForAValueNobodyDeclares", () => {
      const orderStatus = {
        conceptId: "order-status",
        declarationPath: "packages/example/src/order-status.ts",
        exportPath: "@mst/example",
        values: ["draft"],
        fingerprint: "fingerprint-of-draft",
      };
      return buildCatalog([orderStatus]).entriesByValue.get(canonicalValueKey("published"));
    });

    it("resolves to nothing", ({ entriesResolvedForAValueNobodyDeclares }) => {
      expect(entriesResolvedForAValueNobodyDeclares).toBe(undefined);
    });
  });
});

describe("EMPTY_CANONICAL_VALUES_CATALOG", () => {
  const it = test.extend("emptyCatalog", () => EMPTY_CANONICAL_VALUES_CATALOG);

  it("holds no entry and resolves no value", ({ emptyCatalog }) => {
    expect(emptyCatalog).toStrictEqual({
      entries: [],
      entriesByFingerprint: new Map(),
      entriesByValue: new Map(),
    });
  });
});
