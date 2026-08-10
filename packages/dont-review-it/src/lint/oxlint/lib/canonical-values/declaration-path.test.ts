import { expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { declaresConceptAt, matchesDeclarationPath } from "./declaration-path.ts";
import { fingerprintValues } from "./fingerprint.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const ORDER_STATUS: CanonicalValue[] = ["draft", "published"];

const ORDER_STATUS_ENTRY = {
  conceptId: "order.status",
  declarationPath: "packages/order/src/status.ts",
  exportPath: "@mst/order",
  values: ORDER_STATUS,
  fingerprint: fingerprintValues(ORDER_STATUS),
};

const CATALOG = buildCatalog([ORDER_STATUS_ENTRY]);

test("an absolute path matches the repository relative declaration path it ends with", () => {
  expect(matchesDeclarationPath("/repo/packages/order/src/status.ts", ORDER_STATUS_ENTRY)).toBe(
    true,
  );
});

test("a repository relative path matches the declaration path exactly", () => {
  expect(matchesDeclarationPath("packages/order/src/status.ts", ORDER_STATUS_ENTRY)).toBe(true);
});

test("a windows path matches through the same separators", () => {
  expect(
    matchesDeclarationPath(String.raw`C:\repo\packages\order\src\status.ts`, ORDER_STATUS_ENTRY),
  ).toBe(true);
});

test("a suffix that starts inside a segment does not match", () => {
  expect(
    matchesDeclarationPath("/repo/vendored-packages/order/src/status.ts", ORDER_STATUS_ENTRY),
  ).toBe(false);
});

test("another file in the same package does not declare the concept", () => {
  expect(declaresConceptAt(CATALOG, "order.status", "/repo/packages/order/src/order.ts")).toBe(
    false,
  );
});

test("the declaring file declares the concept the annotation names", () => {
  expect(declaresConceptAt(CATALOG, "order.status", "/repo/packages/order/src/status.ts")).toBe(
    true,
  );
});

test("a concept the catalog does not know is declared nowhere", () => {
  expect(
    declaresConceptAt(CATALOG, "totally.unrelated", "/repo/packages/order/src/status.ts"),
  ).toBe(false);
});
