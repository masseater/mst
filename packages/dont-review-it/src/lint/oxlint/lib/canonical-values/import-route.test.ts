import { describe, expect, test } from "vite-plus/test";

import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { importRouteStatus } from "./import-route.ts";

describe("import-route", () => {
  const REPOSITORY_ROOT = "/repository";

  const entry = (overrides: Partial<CanonicalValuesEntry>): CanonicalValuesEntry => ({
    conceptId: "order.status",
    declarationPath: "packages/order-vocabulary/src/order-status.ts",
    exportPath: "@mst/order-vocabulary",
    values: ["draft", "published"],
    fingerprint: fingerprintValues(["draft", "published"]),
    ...overrides,
  });

  const catalog = buildCatalog([entry({})]);

  const statusOf = (specifier: string, filename: string): string =>
    importRouteStatus(specifier, filename, REPOSITORY_ROOT, catalog);

  test("a specifier that is the registered export path is registered", () => {
    expect(statusOf("@mst/order-vocabulary", "/repository/packages/order/src/schema.ts")).toBe(
      "registered",
    );
  });

  test("a specifier below the registered export path is registered", () => {
    expect(
      statusOf("@mst/order-vocabulary/status", "/repository/packages/order/src/schema.ts"),
    ).toBe("registered");
  });

  test("a specifier that only starts with the same letters as the export path is not registered", () => {
    expect(
      statusOf("@mst/order-vocabulary-legacy", "/repository/packages/order/src/schema.ts"),
    ).toBe("external");
  });

  test("a relative specifier that resolves to the registered declaration is registered", () => {
    expect(
      statusOf("./order-status.ts", "/repository/packages/order-vocabulary/src/schema.ts"),
    ).toBe("registered");
  });

  test("a relative specifier written without an extension resolves the same way", () => {
    expect(statusOf("./order-status", "/repository/packages/order-vocabulary/src/schema.ts")).toBe(
      "registered",
    );
  });

  test("a relative specifier written with the js extension resolves to the ts declaration", () => {
    expect(
      statusOf("./order-status.js", "/repository/packages/order-vocabulary/src/schema.ts"),
    ).toBe("registered");
  });

  test("a relative specifier the catalog does not resolve is unregistered", () => {
    expect(statusOf("./statuses.ts", "/repository/packages/order/src/schema.ts")).toBe(
      "unregistered",
    );
  });

  test("a subpath specifier the catalog does not resolve is unregistered", () => {
    expect(statusOf("#internal/statuses", "/repository/packages/order/src/schema.ts")).toBe(
      "unregistered",
    );
  });

  test("a subpath specifier the catalog publishes is registered", () => {
    const subpathCatalog = buildCatalog([entry({ exportPath: "#internal/statuses" })]);

    expect(
      importRouteStatus(
        "#internal/statuses",
        "/repository/packages/order/src/schema.ts",
        REPOSITORY_ROOT,
        subpathCatalog,
      ),
    ).toBe("registered");
  });

  test("a bare specifier that reaches no registered owner comes from outside the repository", () => {
    expect(statusOf("order-statuses", "/repository/packages/order/src/schema.ts")).toBe("external");
  });

  test("a declaration reached through an index module keeps resolving to its owner", () => {
    const indexCatalog = buildCatalog([
      entry({ declarationPath: "packages/order-vocabulary/src/index.ts" }),
    ]);

    expect(
      importRouteStatus(
        "./index.ts",
        "/repository/packages/order-vocabulary/src/schema.ts",
        REPOSITORY_ROOT,
        indexCatalog,
      ),
    ).toBe("registered");
  });
});
