import { describe, expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { declaresConceptAt } from "./declaration-path.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const ORDER_STATUS: readonly CanonicalValue[] = ["draft", "published"];

const CATALOG = buildCatalog([
  {
    conceptId: "order.status",
    declarationPath: "packages/order/src/status.ts",
    exportPath: "@mst/order",
    values: ORDER_STATUS,
    fingerprint: "fingerprint-of-draft-and-published",
  },
]);

const it = test
  .extend("declaredAtAbsolutePath", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/packages/order/src/status.ts",
    }))
  .extend("declaredAtRelativePath", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "packages/order/src/status.ts",
    }),
  )
  .extend("declaredAtWindowsPath", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: String.raw`C:\repo\packages\order\src\status.ts`,
    }),
  )
  .extend("declaredAtPathMatchingInsideASegment", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/vendored-packages/order/src/status.ts",
    }),
  )
  .extend("declaredAtNeighbouringFile", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/packages/order/src/order.ts",
    }),
  )
  .extend("declaredForUnknownConcept", () =>
    declaresConceptAt(CATALOG, {
      conceptId: "totally.unrelated",
      path: "/repo/packages/order/src/status.ts",
    }),
  );

describe("declaration-path", () => {
  it("the declaring file declares the concept the annotation names", ({
    declaredAtAbsolutePath,
  }) => {
    expect(declaredAtAbsolutePath).toBe(true);
  });

  it("the declaring file is recognized through a repository relative path", ({
    declaredAtRelativePath,
  }) => {
    expect(declaredAtRelativePath).toBe(true);
  });

  it("the declaring file is recognized through a windows path", ({ declaredAtWindowsPath }) => {
    expect(declaredAtWindowsPath).toBe(true);
  });

  it("a path whose suffix starts inside a segment declares nothing", ({
    declaredAtPathMatchingInsideASegment,
  }) => {
    expect(declaredAtPathMatchingInsideASegment).toBe(false);
  });

  it("another file in the same package does not declare the concept", ({
    declaredAtNeighbouringFile,
  }) => {
    expect(declaredAtNeighbouringFile).toBe(false);
  });

  it("a concept the catalog does not know is declared nowhere", ({ declaredForUnknownConcept }) => {
    expect(declaredForUnknownConcept).toBe(false);
  });
});
