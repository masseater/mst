import { expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { declaresConceptAt } from "./declaration-path.ts";
import { fingerprintValues, type CanonicalValue } from "./fingerprint.ts";

const ORDER_STATUS: CanonicalValue[] = ["draft", "published"];

const CATALOG = buildCatalog([
  {
    conceptId: "order.status",
    declarationPath: "packages/order/src/status.ts",
    exportPath: "@mst/order",
    values: ORDER_STATUS,
    fingerprint: fingerprintValues(ORDER_STATUS),
  },
]);

test("the declaring file declares the concept the annotation names", () => {
  expect(
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/packages/order/src/status.ts",
    }),
  ).toBe(true);
});

test("the declaring file is recognized through a repository relative path", () => {
  expect(
    declaresConceptAt(CATALOG, { conceptId: "order.status", path: "packages/order/src/status.ts" }),
  ).toBe(true);
});

test("the declaring file is recognized through a windows path", () => {
  expect(
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: String.raw`C:\repo\packages\order\src\status.ts`,
    }),
  ).toBe(true);
});

test("a path whose suffix starts inside a segment declares nothing", () => {
  expect(
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/vendored-packages/order/src/status.ts",
    }),
  ).toBe(false);
});

test("another file in the same package does not declare the concept", () => {
  expect(
    declaresConceptAt(CATALOG, {
      conceptId: "order.status",
      path: "/repo/packages/order/src/order.ts",
    }),
  ).toBe(false);
});

test("a concept the catalog does not know is declared nowhere", () => {
  expect(
    declaresConceptAt(CATALOG, {
      conceptId: "totally.unrelated",
      path: "/repo/packages/order/src/status.ts",
    }),
  ).toBe(false);
});
