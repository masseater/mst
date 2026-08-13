import { describe, expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { declarationEntriesAt } from "./declaration-path.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const ORDER_STATUS: readonly CanonicalValue[] = ["draft", "published"];

const CATALOG = buildCatalog([
  {
    annotationStart: 0,
    binding: "ORDER_STATUSES",
    bindingStart: 40,
    conceptId: "order.status",
    declarationEnd: 80,
    declarationPath: "packages/order/src/status.ts",
    declarationStart: 20,
    importRoutes: [
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/order/src/order-status.ts"],
        specifier: "@mst/order",
      },
    ],
    packageName: "@mst/order",
    values: ORDER_STATUS,
    fingerprint: "fingerprint-of-draft-and-published",
  },
]);

describe("declarationEntriesAt", () => {
  describe("the declaring file named by an absolute path", () => {
    const it = test.extend("conceptIdsDeclaredAtTheAbsolutePath", () =>
      declarationEntriesAt(CATALOG, {
        path: "/repo/packages/order/src/status.ts",
        repositoryRoot: "/repo",
      }).map((declaration) => declaration.conceptId));

    it("declares the concept the annotation names", ({ conceptIdsDeclaredAtTheAbsolutePath }) => {
      expect(conceptIdsDeclaredAtTheAbsolutePath).toStrictEqual(["order.status"]);
    });
  });

  describe("the declaring file named by a repository relative path", () => {
    const it = test.extend("conceptIdsDeclaredAtTheRepositoryRelativePath", () =>
      declarationEntriesAt(CATALOG, {
        path: "packages/order/src/status.ts",
        repositoryRoot: "/repo",
      }).map((declaration) => declaration.conceptId));

    it("is recognized as the declaring file", ({
      conceptIdsDeclaredAtTheRepositoryRelativePath,
    }) => {
      expect(conceptIdsDeclaredAtTheRepositoryRelativePath).toStrictEqual(["order.status"]);
    });
  });

  describe("the declaring file named by a windows path", () => {
    const it = test.extend("conceptIdsDeclaredAtTheWindowsPath", () =>
      declarationEntriesAt(CATALOG, {
        path: String.raw`C:\repo\packages\order\src\status.ts`,
        repositoryRoot: String.raw`C:\repo`,
      }).map((declaration) => declaration.conceptId));

    it("is recognized as the declaring file", ({ conceptIdsDeclaredAtTheWindowsPath }) => {
      expect(conceptIdsDeclaredAtTheWindowsPath).toStrictEqual(["order.status"]);
    });
  });

  describe("a path whose suffix starts inside a segment", () => {
    const it = test.extend("conceptIdsDeclaredWhereTheSuffixStartsInsideASegment", () =>
      declarationEntriesAt(CATALOG, {
        path: "/repo/vendored-packages/order/src/status.ts",
        repositoryRoot: "/repo",
      }).map((declaration) => declaration.conceptId));

    it("declares nothing", ({ conceptIdsDeclaredWhereTheSuffixStartsInsideASegment }) => {
      expect(conceptIdsDeclaredWhereTheSuffixStartsInsideASegment).toStrictEqual([]);
    });
  });

  describe("the same relative suffix under another repository", () => {
    const it = test.extend("conceptIdsDeclaredUnderAnotherRepository", () =>
      declarationEntriesAt(CATALOG, {
        path: "/vendor/repo/packages/order/src/status.ts",
        repositoryRoot: "/repo",
      }).map((declaration) => declaration.conceptId));

    it("declares nothing", ({ conceptIdsDeclaredUnderAnotherRepository }) => {
      expect(conceptIdsDeclaredUnderAnotherRepository).toStrictEqual([]);
    });
  });

  describe("another file in the same package", () => {
    const it = test.extend("conceptIdsDeclaredAtAnotherFileInTheSamePackage", () =>
      declarationEntriesAt(CATALOG, {
        path: "/repo/packages/order/src/order.ts",
        repositoryRoot: "/repo",
      }).map((declaration) => declaration.conceptId));

    it("does not declare the concept", ({ conceptIdsDeclaredAtAnotherFileInTheSamePackage }) => {
      expect(conceptIdsDeclaredAtAnotherFileInTheSamePackage).toStrictEqual([]);
    });
  });

  describe("a concept the catalog does not know", () => {
    const it = test.extend("declarationsAtTheDeclaringFile", () =>
      declarationEntriesAt(CATALOG, {
        path: "/repo/packages/order/src/status.ts",
        repositoryRoot: "/repo",
      }));

    it("is declared nowhere", ({ declarationsAtTheDeclaringFile }) => {
      expect(declarationsAtTheDeclaringFile).toStrictEqual([
        {
          annotationStart: 0,
          binding: "ORDER_STATUSES",
          bindingStart: 40,
          conceptId: "order.status",
          declarationEnd: 80,
          declarationPath: "packages/order/src/status.ts",
          declarationStart: 20,
          importRoutes: [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/order/src/order-status.ts"],
              specifier: "@mst/order",
            },
          ],
          packageName: "@mst/order",
          values: ["draft", "published"],
          fingerprint: "fingerprint-of-draft-and-published",
        },
      ]);
    });
  });
});
