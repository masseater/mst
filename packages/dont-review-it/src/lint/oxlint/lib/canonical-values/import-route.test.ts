import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog } from "./builder.ts";
import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "./canonical-values-test-fixture.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { importRouteStatus } from "./import-route.ts";

describe("import-route", () => {
  const REPOSITORY_ROOT = "/repository";

  const entry = (overrides: Partial<CanonicalValuesEntry>): CanonicalValuesEntry => ({
    annotationStart: 0,
    binding: "ORDER_STATUSES",
    bindingStart: 40,
    conceptId: "order.status",
    declarationEnd: 80,
    declarationPath: "packages/order-vocabulary/src/order-status.ts",
    declarationStart: 20,
    importRoutes: [
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
        specifier: "@mst/order-vocabulary",
      },
      {
        exportName: "PUBLIC_STATUSES",
        resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
        specifier: "@mst/order-vocabulary/alias",
      },
    ],
    packageName: "@mst/order-vocabulary",
    values: ["draft", "published"],
    fingerprint: fingerprintValues(["draft", "published"]),
    ...overrides,
  });

  const catalog = buildCatalog([entry({})]);

  const statusOf = (
    ...[specifier, filename, importedName = "ORDER_STATUSES"]: readonly [string, string, string?]
  ): string =>
    importRouteStatus(
      { importedName, specifier, filename, repositoryRoot: REPOSITORY_ROOT },
      catalog,
    );

  const directStatusOf = ({
    declarationPath = "src/order-status.ts",
    importedName = "ORDER_STATUSES",
    specifier,
  }: {
    readonly declarationPath?: string;
    readonly importedName?: string;
    readonly specifier: (repositoryRoot: string) => string;
  }): string => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        [declarationPath]: "export const ORDER_STATUSES = [] as const;\n",
        "src/schema.ts": "export {};\n",
      },
    });
    return importRouteStatus(
      {
        filename: join(repositoryRoot, "src/schema.ts"),
        importedName,
        repositoryRoot,
        specifier: specifier(repositoryRoot),
      },
      buildCatalog([
        entry({
          declarationPath,
          importRoutes: [],
        }),
      ]),
    );
  };

  test("another binding from the same public specifier is unregistered", () => {
    expect(
      statusOf(
        "@mst/order-vocabulary",
        "/repository/packages/order/src/schema.ts",
        "SHADOW_STATUSES",
      ),
    ).toBe("unregistered");
  });

  test("an unregistered subpath of a package with an owner is unregistered", () => {
    expect(
      statusOf("@mst/order-vocabulary/shadow", "/repository/packages/order/src/schema.ts"),
    ).toBe("unregistered");
  });

  test("a package with no public owner route still rejects its shadow export", () => {
    const privateCatalog = buildCatalog([entry({ importRoutes: [] })]);

    expect(
      importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@mst/order-vocabulary/shadow",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: REPOSITORY_ROOT,
        },
        privateCatalog,
      ),
    ).toBe("unregistered");
  });

  test("a repository package with no valid owner entry remains unregistered", () => {
    const invalidOwnerCatalog = buildCatalog([], ["@mst/order-vocabulary"]);

    expect(
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: REPOSITORY_ROOT,
        },
        invalidOwnerCatalog,
      ),
    ).toBe("unregistered");
  });

  test("a specifier that only starts with the same letters as the export path is not registered", () => {
    expect(
      statusOf("@mst/order-vocabulary-legacy", "/repository/packages/order/src/schema.ts"),
    ).toBe("external");
  });

  test.each([
    { specifier: "./order-status.ts" },
    { specifier: "./order-status" },
    { specifier: "./order-status.js" },
  ])("a relative owner route $specifier is registered", ({ specifier }) => {
    expect(directStatusOf({ specifier: () => specifier })).toBe("registered");
  });

  test("a relative declaration route registers only the owner binding", () => {
    expect(
      directStatusOf({
        importedName: "PUBLIC_STATUSES",
        specifier: () => "./order-status.ts",
      }),
    ).toBe("unregistered");
  });

  test("a relative route from a non-existing consumer cannot claim an owner", () => {
    expect(
      statusOf(
        "../../order-vocabulary/src/order-status.ts",
        "/repository/packages/consumer/src/schema.ts",
      ),
    ).toBe("unregistered");
  });

  test("an absolute repository path registers only the exact declaration binding", () => {
    expect(
      directStatusOf({
        specifier: (repositoryRoot) => join(repositoryRoot, "src/order-status.ts"),
      }),
    ).toBe("registered");
    expect(
      directStatusOf({
        importedName: "PUBLIC_STATUSES",
        specifier: (repositoryRoot) => join(repositoryRoot, "src/order-status.ts"),
      }),
    ).toBe("unregistered");
  });

  test("another absolute repository path is unregistered", () => {
    expect(
      statusOf(
        "/repository/packages/order-vocabulary/src/shadow.ts",
        "/repository/packages/order/src/schema.ts",
      ),
    ).toBe("unregistered");
  });

  test("an absolute path outside the repository is external", () => {
    expect(statusOf("/vendor/order-status.ts", "/repository/packages/order/src/schema.ts")).toBe(
      "external",
    );
  });

  test("TypeScript path aliases keep repository route and binding identity", () => {
    const root = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot: root,
      files: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"],
              "@internal/shadow": ["packages/order-vocabulary/src/shadow.ts"],
              "@internal/missing": ["packages/missing/statuses.ts"],
              "@internal/missing/*": ["packages/missing/*"],
            },
          },
        }),
        "packages/order-vocabulary/src/order-status.ts": "export const ORDER_STATUSES = [];\n",
        "packages/order-vocabulary/src/shadow.ts": "export const ORDER_STATUSES = [];\n",
        "packages/order/src/schema.ts": "export {};\n",
      },
    });
    const aliasCatalog = buildCatalog([
      entry({
        declarationPath: "packages/order-vocabulary/src/order-status.ts",
        importRoutes: [],
      }),
    ]);
    const status = (specifier: string, importedName = "ORDER_STATUSES"): string =>
      importRouteStatus(
        {
          importedName,
          specifier,
          filename: join(root, "packages/order/src/schema.ts"),
          repositoryRoot: root,
        },
        aliasCatalog,
      );

    expect(status("@internal/owner")).toBe("registered");
    expect(status("@internal/owner", "SHADOW_STATUSES")).toBe("unregistered");
    expect(status("@internal/shadow")).toBe("unregistered");
    expect(status("@internal/missing")).toBe("unregistered");
    expect(status("@internal/missing/statuses")).toBe("unregistered");
    expect(status("@vite/unresolved-alias")).toBe("external");
    expect(status("order-statuses")).toBe("external");
  });

  test("a parent TypeScript config cannot redefine routes inside the repository", () => {
    const outer = createCanonicalValuesTestRepository();
    const root = join(outer, "repository");
    writeCanonicalValuesTestFiles({
      repositoryRoot: outer,
      files: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@external/statuses": ["repository/src/statuses.ts"] },
          },
        }),
        "repository/src/consumer.ts": "export {};\n",
        "repository/src/statuses.ts":
          '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      },
    });
    const nestedCatalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

    expect(
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@external/statuses",
          filename: join(root, "src/consumer.ts"),
          repositoryRoot: root,
        },
        nestedCatalog,
      ),
    ).toBe("external");
  });

  test("direct imports use the TypeScript-resolved competing extension", () => {
    const root = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot: root,
      files: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
        "src/status.ts":
          '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "src/status.tsx": 'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "src/consumer.ts": "export {};\n",
      },
    });
    const directCatalog = buildCanonicalValuesCatalog({ repositoryRoot: root });
    const status = (specifier: string): string =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier,
          filename: join(root, "src/consumer.ts"),
          repositoryRoot: root,
        },
        directCatalog,
      );

    expect(status("./status.js")).toBe("registered");
    expect(status("./status.jsx")).toBe("unregistered");
    expect(status(join(root, "src/status.js"))).toBe("registered");
    expect(status(join(root, "src/status.jsx"))).toBe("unregistered");
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

  test("a resolved package imports specifier the catalog publishes is registered", () => {
    const root = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot: root,
      files: {
        "package.json": JSON.stringify({
          imports: { "#internal/statuses": "./src/statuses.ts" },
          name: "@fixture/consumer",
          type: "module",
        }),
        "src/schema.ts": "export {};\n",
        "src/statuses.ts": "export const ORDER_STATUSES = [];\n",
      },
    });
    const subpathCatalog = buildCatalog([
      entry({
        declarationPath: "src/statuses.ts",
        importRoutes: [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["src/statuses.ts"],
            specifier: "#internal/statuses",
          },
        ],
      }),
    ]);

    expect(
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "#internal/statuses",
          filename: join(root, "src/schema.ts"),
          repositoryRoot: root,
        },
        subpathCatalog,
      ),
    ).toBe("registered");
  });

  test("a bare specifier that reaches no registered owner comes from outside the repository", () => {
    expect(statusOf("order-statuses", "/repository/packages/order/src/schema.ts")).toBe("external");
  });

  test("a declaration reached through an index module keeps resolving to its owner", () => {
    expect(directStatusOf({ declarationPath: "src/index.ts", specifier: () => "./index.ts" })).toBe(
      "registered",
    );
  });

  test("a directory index owner does not capture a sibling file route", () => {
    const indexCatalog = buildCatalog([
      entry({
        declarationPath: "packages/order-vocabulary/src/status/index.ts",
        importRoutes: [],
      }),
    ]);

    expect(
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: REPOSITORY_ROOT,
        },
        indexCatalog,
      ),
    ).toBe("unregistered");
  });
});
