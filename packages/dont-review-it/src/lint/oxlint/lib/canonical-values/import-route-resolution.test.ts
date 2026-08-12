import { mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog } from "./builder.ts";
import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "./canonical-values-test-fixture.ts";
import {
  IMPORT_MODULE_RESOLUTION_MODE,
  repositoryModulePath,
  REQUIRE_MODULE_RESOLUTION_MODE,
} from "./import-route-resolution.ts";
import { importRouteStatus } from "./import-route.ts";

type PublicRouteQuery = {
  readonly consumer: "missing-consumer" | "public-consumer" | "shadow-consumer" | "types-consumer";
  readonly importedName?: string;
  readonly specifier?: string;
};

describe("import route source resolution", () => {
  test("Vite query and asset imports resolve only existing repository sources", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "fixtures/status.module.css": ".draft {}\n",
        "fixtures/status.txt": "draft\n",
        "src/consumer.ts": "export {};\n",
        "vite.config.ts": `export default { resolve: { alias: { "@fixture": ${JSON.stringify(
          join(repositoryRoot, "fixtures"),
        )} } } };\n`,
      },
    });
    const filename = join(repositoryRoot, "src/consumer.ts");
    const sourcePath = (specifier: string): string | null =>
      repositoryModulePath({
        filename,
        importedName: "<namespace>",
        repositoryRoot,
        specifier,
      });

    expect(sourcePath("../fixtures/status.txt?raw")).toBe(
      realpathSync.native(join(repositoryRoot, "fixtures/status.txt")),
    );
    expect(sourcePath("../fixtures/status.module.css")).toBe(
      realpathSync.native(join(repositoryRoot, "fixtures/status.module.css")),
    );
    expect(sourcePath("/fixtures/status.txt?url")).toBe(
      realpathSync.native(join(repositoryRoot, "fixtures/status.txt")),
    );
    expect(sourcePath("@fixture/status.txt?raw")).toBe(
      realpathSync.native(join(repositoryRoot, "fixtures/status.txt")),
    );
    expect(sourcePath("../fixtures/missing.txt?raw")).toBeNull();
  });

  test("conditional exports resolve with the syntax-specific module mode", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "packages/vocabulary/fixtures/status.mjs": 'export const status = "fixture";\n',
        "packages/vocabulary/package.json": JSON.stringify({
          exports: {
            "./status": {
              import: "./fixtures/status.mjs",
              require: "./src/status.cjs",
            },
          },
          name: "@fixture/vocabulary",
          type: "module",
        }),
        "packages/vocabulary/src/status.cjs": 'exports.status = "production";\n',
        "src/main.cjs": "export {};\n",
      },
    });
    const packageScope = join(repositoryRoot, "node_modules/@fixture");
    mkdirSync(packageScope, { recursive: true });
    symlinkSync(
      join(repositoryRoot, "packages/vocabulary"),
      join(packageScope, "vocabulary"),
      "dir",
    );
    const query = {
      filename: join(repositoryRoot, "src/main.cjs"),
      importedName: "<namespace>",
      repositoryRoot,
      specifier: "@fixture/vocabulary/status",
    } as const;
    expect(repositoryModulePath({ ...query, resolutionMode: IMPORT_MODULE_RESOLUTION_MODE })).toBe(
      realpathSync.native(join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs")),
    );
    expect(repositoryModulePath({ ...query, resolutionMode: REQUIRE_MODULE_RESOLUTION_MODE })).toBe(
      realpathSync.native(join(repositoryRoot, "packages/vocabulary/src/status.cjs")),
    );
  });

  test("module values and export patterns keep their exact public source identity", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/module.ts",
            "./shadow": "./src/module-shadow.ts",
            "./pattern/*": "./src/pattern/*.ts",
          },
        }),
        "packages/vocabulary/src/order-status.ts":
          '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "packages/vocabulary/src/module.ts":
          'import { ORDER_STATUSES } from "./order-status.ts";\nexport = ORDER_STATUSES;\n',
        "packages/vocabulary/src/module-shadow.ts":
          'const ORDER_STATUSES = ["draft", "published"] as const;\nexport = ORDER_STATUSES;\n',
        "packages/vocabulary/src/pattern/owner.ts":
          'export { ORDER_STATUSES } from "../order-status.ts";\n',
        "packages/vocabulary/src/pattern/shadow.ts":
          'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "packages/consumer/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@fixture/vocabulary": ["../vocabulary/src/module.ts"],
              "@fixture/vocabulary/shadow": ["../vocabulary/src/module-shadow.ts"],
              "@fixture/vocabulary/pattern/*": ["../vocabulary/src/pattern/*.ts"],
            },
          },
        }),
        "packages/consumer/src/schema.ts": "export {};\n",
      },
    });
    const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
    const status = (specifier: string, importedName: string): string =>
      importRouteStatus(
        {
          filename: join(repositoryRoot, "packages/consumer/src/schema.ts"),
          importedName,
          repositoryRoot,
          specifier,
        },
        catalog,
      );

    expect(status("@fixture/vocabulary", "<module>")).toBe("registered");
    expect(status("@fixture/vocabulary", "<namespace>")).toBe("unregistered");
    expect(status("@fixture/vocabulary", "ORDER_STATUSES")).toBe("unregistered");
    expect(status("@fixture/vocabulary/shadow", "<module>")).toBe("unregistered");
    expect(status("@fixture/vocabulary/pattern/owner", "ORDER_STATUSES")).toBe("registered");
    expect(status("@fixture/vocabulary/pattern/owner", "<module>")).toBe("unregistered");
    expect(status("@fixture/vocabulary/pattern/shadow", "ORDER_STATUSES")).toBe("unregistered");
  });

  test("an exact public specifier resolves only to its catalogued source identity", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/index.ts", "./alias": "./src/alias.ts" },
        }),
        "packages/vocabulary/src/order-status.ts":
          '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./order-status.ts";\n',
        "packages/vocabulary/src/alias.ts":
          'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./order-status.ts";\n',
        "packages/vocabulary/src/shadow.ts":
          'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "packages/vocabulary/src/index.d.ts":
          'export declare const ORDER_STATUSES: readonly ["draft", "published"];\n',
        "packages/shadow-consumer/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@fixture/vocabulary": ["../vocabulary/src/shadow.ts"] },
          },
        }),
        "packages/shadow-consumer/src/schema.ts": "export {};\n",
        "packages/public-consumer/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@fixture/vocabulary": ["../vocabulary/src/index.ts"],
              "@fixture/vocabulary/alias": ["../vocabulary/src/alias.ts"],
            },
          },
        }),
        "packages/public-consumer/src/schema.ts": "export {};\n",
        "packages/missing-consumer/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@fixture/vocabulary": ["../vocabulary/src/missing.ts"] },
          },
        }),
        "packages/missing-consumer/src/schema.ts": "export {};\n",
        "packages/types-consumer/tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@fixture/vocabulary": ["../vocabulary/src/index.d.ts"] },
          },
        }),
        "packages/types-consumer/src/schema.ts": "export {};\n",
      },
    });
    const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
    const status = ({
      consumer,
      importedName = "ORDER_STATUSES",
      specifier = "@fixture/vocabulary",
    }: PublicRouteQuery): string =>
      importRouteStatus(
        {
          filename: join(repositoryRoot, "packages", consumer, "src/schema.ts"),
          importedName,
          repositoryRoot,
          specifier,
        },
        catalog,
      );

    expect(status({ consumer: "public-consumer" })).toBe("registered");
    expect(
      status({
        consumer: "public-consumer",
        importedName: "PUBLIC_STATUSES",
        specifier: "@fixture/vocabulary/alias",
      }),
    ).toBe("registered");
    expect(status({ consumer: "public-consumer", specifier: "@fixture/vocabulary/alias" })).toBe(
      "unregistered",
    );
    expect(status({ consumer: "shadow-consumer" })).toBe("unregistered");
    expect(status({ consumer: "missing-consumer" })).toBe("unregistered");
    expect(status({ consumer: "types-consumer" })).toBe("unregistered");
    expect(
      importRouteStatus(
        {
          filename: join(repositoryRoot, "virtual-consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "@fixture/vocabulary",
        },
        catalog,
      ),
    ).toBe("unregistered");
  });

  test("a changed path mapping cannot reuse a previous module resolution", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const configPath = "packages/consumer/tsconfig.json";
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/index.ts" },
        }),
        "packages/vocabulary/src/order-status.ts":
          '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
        "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./order-status.ts";\n',
        "packages/vocabulary/src/shadow.ts":
          'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
        [configPath]: JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@fixture/vocabulary": ["../vocabulary/src/index.ts"] },
          },
        }),
        "packages/consumer/src/schema.ts": "export {};\n",
      },
    });
    const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
    const query = {
      filename: join(repositoryRoot, "packages/consumer/src/schema.ts"),
      importedName: "ORDER_STATUSES",
      repositoryRoot,
      specifier: "@fixture/vocabulary",
    } as const;
    expect(importRouteStatus(query, catalog)).toBe("registered");

    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        [configPath]: JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@fixture/vocabulary": ["../vocabulary/src/shadow.ts"] },
          },
        }),
      },
    });
    expect(importRouteStatus(query, catalog)).toBe("unregistered");
  });
});
