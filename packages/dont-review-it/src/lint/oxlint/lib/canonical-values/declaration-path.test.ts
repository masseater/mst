import { describe, expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { declarationEntriesAt } from "./declaration-path.ts";
import { fingerprintValues, type CanonicalValue } from "./fingerprint.ts";

describe("declaration-path", () => {
  const ORDER_STATUS: CanonicalValue[] = ["draft", "published"];

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
      fingerprint: fingerprintValues(ORDER_STATUS),
    },
  ]);

  const conceptIdsAt = (path: string, repositoryRoot: string): readonly string[] =>
    declarationEntriesAt(CATALOG, { path, repositoryRoot }).map(
      (declarationEntry) => declarationEntry.conceptId,
    );

  test("the declaring file declares the concept the annotation names", () => {
    expect(conceptIdsAt("/repo/packages/order/src/status.ts", "/repo")).toContain("order.status");
  });

  test("the declaring file is recognized through a repository relative path", () => {
    expect(conceptIdsAt("packages/order/src/status.ts", "/repo")).toContain("order.status");
  });

  test("the declaring file is recognized through a windows path", () => {
    expect(
      conceptIdsAt(String.raw`C:\repo\packages\order\src\status.ts`, String.raw`C:\repo`),
    ).toContain("order.status");
  });

  test("a path whose suffix starts inside a segment declares nothing", () => {
    expect(conceptIdsAt("/repo/vendored-packages/order/src/status.ts", "/repo")).toStrictEqual([]);
  });

  test("the same relative suffix under another repository declares nothing", () => {
    expect(conceptIdsAt("/vendor/repo/packages/order/src/status.ts", "/repo")).toStrictEqual([]);
  });

  test("another file in the same package does not declare the concept", () => {
    expect(conceptIdsAt("/repo/packages/order/src/order.ts", "/repo")).toStrictEqual([]);
  });

  test("a concept the catalog does not know is declared nowhere", () => {
    expect(conceptIdsAt("/repo/packages/order/src/status.ts", "/repo")).not.toContain(
      "totally.unrelated",
    );
  });
});
