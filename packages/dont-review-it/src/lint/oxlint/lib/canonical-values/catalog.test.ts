import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, canonicalValueKey } from "./catalog.ts";

describe("buildCatalog", () => {
  describe("a concept that spells the same value twice", () => {
    const it = test.extend("entriesResolvedForARepeatedValue", () => {
      const repeated = {
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 20,
        conceptId: "order-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/order-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
        values: ["draft", "draft"],
        fingerprint: "fingerprint-of-draft",
      };
      return buildCatalog([repeated]).entriesByValue.get(canonicalValueKey("draft"));
    });

    it("is listed against that value once", ({ entriesResolvedForARepeatedValue }) => {
      expect(entriesResolvedForARepeatedValue).toStrictEqual([
        {
          annotationStart: 0,
          binding: "ORDER_STATUSES",
          bindingStart: 20,
          conceptId: "order-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/order-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["draft", "draft"],
          fingerprint: "fingerprint-of-draft",
        },
      ]);
    });
  });

  describe("package names handed to a catalog built from no declaration", () => {
    const it = test.extend("exampleIsKnownToACatalogBuiltFromNoDeclaration", () =>
      buildCatalog([], { packageNames: ["@mst/example"] }).packageNames.has("@mst/example"));

    it("are held without any owning declaration", ({
      exampleIsKnownToACatalogBuiltFromNoDeclaration,
    }) => {
      expect(exampleIsKnownToACatalogBuiltFromNoDeclaration).toBe(true);
    });
  });

  describe("concepts that share a value set", () => {
    const it = test.extend("entriesResolvedForASharedFingerprint", () => {
      const orderStatus = {
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 20,
        conceptId: "order-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/order-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
        values: ["draft", "published"],
        fingerprint: "fingerprint-of-draft-and-published",
      };
      const articleStatus = {
        annotationStart: 0,
        binding: "ARTICLE_STATUSES",
        bindingStart: 20,
        conceptId: "article-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/article-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ARTICLE_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
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
          annotationStart: 0,
          binding: "ORDER_STATUSES",
          bindingStart: 20,
          conceptId: "order-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/order-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["draft", "published"],
          fingerprint: "fingerprint-of-draft-and-published",
        },
        {
          annotationStart: 0,
          binding: "ARTICLE_STATUSES",
          bindingStart: 20,
          conceptId: "article-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/article-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ARTICLE_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["published", "draft"],
          fingerprint: "fingerprint-of-draft-and-published",
        },
      ]);
    });
  });

  describe("a value two concepts own", () => {
    const it = test.extend("entriesResolvedForAValueTwoConceptsOwn", () => {
      const orderStatus = {
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 20,
        conceptId: "order-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/order-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
        values: ["draft"],
        fingerprint: "fingerprint-of-draft",
      };
      const articleStatus = {
        annotationStart: 0,
        binding: "ARTICLE_STATUSES",
        bindingStart: 20,
        conceptId: "article-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/article-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ARTICLE_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
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
          annotationStart: 0,
          binding: "ORDER_STATUSES",
          bindingStart: 20,
          conceptId: "order-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/order-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["draft"],
          fingerprint: "fingerprint-of-draft",
        },
        {
          annotationStart: 0,
          binding: "ARTICLE_STATUSES",
          bindingStart: 20,
          conceptId: "article-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/article-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ARTICLE_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["draft", "archived"],
          fingerprint: "fingerprint-of-draft-and-archived",
        },
      ]);
    });
  });

  describe("a value only one concept owns", () => {
    const it = test.extend("entriesResolvedForAValueOneConceptOwns", () => {
      const orderStatus = {
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 20,
        conceptId: "order-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/order-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
        values: ["draft"],
        fingerprint: "fingerprint-of-draft",
      };
      const articleStatus = {
        annotationStart: 0,
        binding: "ARTICLE_STATUSES",
        bindingStart: 20,
        conceptId: "article-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/article-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ARTICLE_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
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
          annotationStart: 0,
          binding: "ARTICLE_STATUSES",
          bindingStart: 20,
          conceptId: "article-status",
          declarationEnd: 40,
          declarationPath: "packages/example/src/article-status.ts",
          declarationStart: 10,
          importRoutes: [
            {
              exportName: "ARTICLE_STATUSES",
              resolvedSourcePaths: ["packages/example/src/index.ts"],
              specifier: "@mst/example",
            },
          ],
          packageName: "@mst/example",
          values: ["draft", "archived"],
          fingerprint: "fingerprint-of-draft-and-archived",
        },
      ]);
    });
  });

  describe("a value nobody declares", () => {
    const it = test.extend("entriesResolvedForAValueNobodyDeclares", () => {
      const orderStatus = {
        annotationStart: 0,
        binding: "ORDER_STATUSES",
        bindingStart: 20,
        conceptId: "order-status",
        declarationEnd: 40,
        declarationPath: "packages/example/src/order-status.ts",
        declarationStart: 10,
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/example/src/index.ts"],
            specifier: "@mst/example",
          },
        ],
        packageName: "@mst/example",
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
