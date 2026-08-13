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

describe("declaresConceptAt", () => {
  describe("the declaring file named by an absolute path", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "order.status",
        path: "/repo/packages/order/src/status.ts",
      }));

    it("declares the concept the annotation names", ({ declares }) => {
      expect(declares).toBe(true);
    });
  });

  describe("the declaring file named by a repository relative path", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "order.status",
        path: "packages/order/src/status.ts",
      }));

    it("is recognized as the declaring file", ({ declares }) => {
      expect(declares).toBe(true);
    });
  });

  describe("the declaring file named by a windows path", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "order.status",
        path: String.raw`C:\repo\packages\order\src\status.ts`,
      }));

    it("is recognized as the declaring file", ({ declares }) => {
      expect(declares).toBe(true);
    });
  });

  describe("a path whose suffix starts inside a segment", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "order.status",
        path: "/repo/vendored-packages/order/src/status.ts",
      }));

    it("declares nothing", ({ declares }) => {
      expect(declares).toBe(false);
    });
  });

  describe("another file in the same package", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "order.status",
        path: "/repo/packages/order/src/order.ts",
      }));

    it("does not declare the concept", ({ declares }) => {
      expect(declares).toBe(false);
    });
  });

  describe("a concept the catalog does not know", () => {
    const it = test.extend("declares", () =>
      declaresConceptAt(CATALOG, {
        conceptId: "totally.unrelated",
        path: "/repo/packages/order/src/status.ts",
      }));

    it("is declared nowhere", ({ declares }) => {
      expect(declares).toBe(false);
    });
  });
});
