import { mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import * as ts from "typescript-6";
import { describe, expect, test } from "vite-plus/test";

import { gitOutput } from "../git-output.ts";
import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "./canonical-values.test-fixture.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import {
  matchesConfiguredPathAlias,
  repositoryModulePath,
  resolvedDirectImportEntries,
  resolvedPublicImportEntries,
} from "./import-route-resolution.ts";
import { importRouteStatus } from "./import-route.ts";

describe("import route source resolution", () => {
  test("relative extensions and TypeScript paths resolve exact repository sources", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { "@internal/status": ["src/status.ts"] } },
        }),
        "src/consumer.ts": "export {};\n",
        "src/status.ts": "export const status = 1;\n",
      },
    });
    const filename = join(repositoryRoot, "src/consumer.ts");
    const resolved = realpathSync.native(join(repositoryRoot, "src/status.ts"));
    const sourcePath = (specifier: string): string | null =>
      repositoryModulePath({ filename, importedName: "status", repositoryRoot, specifier });

    expect(sourcePath("./status.ts")).toBe(resolved);
    expect(sourcePath("./status")).toBe(resolved);
    expect(sourcePath("./status.js")).toBe(resolved);
    expect(sourcePath("@internal/status")).toBe(resolved);
    expect(sourcePath("./missing")).toBeNull();
  });

  test("conditional exports use the syntax-specific module mode", () => {
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
      importedName: "status",
      repositoryRoot,
      specifier: "@fixture/vocabulary/status",
    } as const;

    expect(repositoryModulePath({ ...query, resolutionMode: ts.ModuleKind.ESNext })).toBe(
      realpathSync.native(join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs")),
    );
    expect(repositoryModulePath({ ...query, resolutionMode: ts.ModuleKind.CommonJS })).toBe(
      realpathSync.native(join(repositoryRoot, "packages/vocabulary/src/status.cjs")),
    );
  });

  test("an ignored untracked source is external while the same tracked source is repository code", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        ".gitignore": "ignored\n",
        "ignored/status.ts": "export const status = 1;\n",
        "src/consumer.ts": "export {};\n",
      },
    });
    const query = {
      filename: join(repositoryRoot, "src/consumer.ts"),
      importedName: "status",
      repositoryRoot,
      specifier: "../ignored/status.ts",
    } as const;

    expect(
      importRouteStatus(
        query,
        buildCatalog([], {
          sourceScope: { isIgnored: (sourcePath) => sourcePath.includes("/ignored/") },
        }),
      ),
    ).toBe("external");

    gitOutput(["add", "-f", "ignored/status.ts"], {
      cwd: repositoryRoot,
      env: process.env,
    });

    expect(importRouteStatus(query, buildCatalog([]))).toBe("unregistered");
  });

  test("an ignored repository module cannot resolve a registered owner entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "src/order-status.ts": "export const ORDER_STATUSES = [] as const;\n",
        "src/schema.ts": "export {};\n",
      },
    });
    const ownerDeclaration: CanonicalValuesEntry = {
      annotationStart: 0,
      binding: "ORDER_STATUSES",
      bindingStart: 40,
      conceptId: "order.status",
      declarationEnd: 80,
      declarationPath: "src/order-status.ts",
      declarationStart: 20,
      fingerprint: "fixture",
      importRoutes: [],
      packageName: null,
      values: ["draft", "published"],
    };
    const query = {
      filename: join(repositoryRoot, "src/schema.ts"),
      importedName: "ORDER_STATUSES",
      repositoryRoot,
      specifier: "./order-status.ts",
    } as const;

    expect(
      importRouteStatus(
        query,
        buildCatalog([ownerDeclaration], { sourceScope: { isIgnored: () => true } }),
      ),
    ).toBe("external");
  });

  test("file URLs and external paths preserve repository identity boundaries", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: { "src/consumer.ts": "export {};\n", "src/status.ts": "export const status = 1;\n" },
    });
    const query = {
      filename: join(repositoryRoot, "src/consumer.ts"),
      importedName: "status",
      repositoryRoot,
    } as const;
    const repositoryUrl = new URL(`file://${join(repositoryRoot, "src/status.ts")}`).href;

    expect(repositoryModulePath({ ...query, specifier: repositoryUrl })).toBe(
      realpathSync.native(join(repositoryRoot, "src/status.ts")),
    );
    expect(repositoryModulePath({ ...query, specifier: "file:%" })).toBeNull();
    expect(repositoryModulePath({ ...query, specifier: "file:///vendor/status.ts" })).toBeNull();
    expect(repositoryModulePath({ ...query, specifier: "node:fs" })).toBeNull();
  });

  test("configured path patterns require one wildcard and a readable config", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            paths: { "@exact": ["src/exact.ts"], "@one/*": ["src/*"], "@two/*/*": ["src/*"] },
          },
        }),
        "src/consumer.ts": "export {};\n",
      },
    });
    const query = {
      filename: join(repositoryRoot, "src/consumer.ts"),
      importedName: "status",
      repositoryRoot,
    } as const;

    expect(matchesConfiguredPathAlias({ ...query, specifier: "@exact" })).toBe(true);
    expect(matchesConfiguredPathAlias({ ...query, specifier: "@one/status" })).toBe(true);
    expect(matchesConfiguredPathAlias({ ...query, specifier: "@one/status/extra" })).toBe(true);
    expect(matchesConfiguredPathAlias({ ...query, specifier: "@two/a/b" })).toBe(false);
    expect(matchesConfiguredPathAlias({ ...query, specifier: "@other/status" })).toBe(false);
  });

  test("invalid compiler configuration leaves repository resolution closed", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "tsconfig.json": "{ invalid",
        "src/consumer.ts": "export {};\n",
        "src/status.ts": "export const status = 1;\n",
      },
    });
    const query = {
      filename: "src/consumer.ts",
      importedName: "status",
      repositoryRoot,
      specifier: "./status.ts",
    } as const;

    expect(repositoryModulePath(query)).toBe(
      realpathSync.native(join(repositoryRoot, "src/status.ts")),
    );
    expect(matchesConfiguredPathAlias(query)).toBe(false);
  });

  test("resolution classifies repository dependencies as external", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "node_modules/dependency/index.d.ts": "export const status: string;\n",
        "node_modules/dependency/package.json": JSON.stringify({
          name: "dependency",
          types: "index.d.ts",
        }),
        "src/consumer.ts": "export {};\n",
      },
    });

    expect(
      repositoryModulePath({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "dependency",
      }),
    ).toBeNull();
  });

  test("public declaration routes require a readable exported runtime name", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "src/consumer.ts": "export {};\n",
        "src/public.d.ts":
          "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
      },
    });
    const ownerDeclaration = {
      annotationStart: 0,
      binding: "STATUS",
      bindingStart: 0,
      conceptId: "order.status",
      declarationEnd: 1,
      declarationPath: "src/owner.ts",
      declarationStart: 0,
      fingerprint: "fingerprint",
      importRoutes: [
        {
          exportName: "STATUS",
          resolvedSourcePaths: ["src/runtime.ts"],
          specifier: "./public.d.ts",
        },
      ],
      packageName: null,
      values: ["draft", "published"],
    } as const;
    const query = {
      filename: "src/consumer.ts",
      importedName: "STATUS",
      repositoryRoot,
      specifier: "./public.d.ts",
    } as const;

    expect(resolvedPublicImportEntries(query, [ownerDeclaration])).toStrictEqual([
      ownerDeclaration,
    ]);
    expect(
      resolvedPublicImportEntries({ ...query, importedName: "MISSING" }, [ownerDeclaration]),
    ).toStrictEqual([]);
    expect(
      resolvedPublicImportEntries({ ...query, specifier: "node:fs" }, [ownerDeclaration]),
    ).toStrictEqual([]);
  });

  test("direct and public entry matching requires source and exported binding identity", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "src/consumer.ts": "export {};\n",
        "src/owner.ts": "export const ORDER_STATUSES = [];\n",
        "src/public.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
      },
    });
    const ownerDeclaration = {
      annotationStart: 0,
      binding: "ORDER_STATUSES",
      bindingStart: 0,
      conceptId: "order.status",
      declarationEnd: 1,
      declarationPath: "src/owner.ts",
      declarationStart: 0,
      fingerprint: "fingerprint",
      importRoutes: [
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["src/public.ts"],
          specifier: "./public.ts",
        },
      ],
      packageName: null,
      values: ["draft", "published"],
    } as const;
    const query = {
      filename: join(repositoryRoot, "src/consumer.ts"),
      importedName: "ORDER_STATUSES",
      repositoryRoot,
    } as const;

    expect(
      resolvedDirectImportEntries({ ...query, specifier: "./owner.ts" }, [ownerDeclaration]),
    ).toStrictEqual([ownerDeclaration]);
    expect(
      resolvedDirectImportEntries({ ...query, specifier: "./missing.ts" }, [ownerDeclaration]),
    ).toStrictEqual([]);
    expect(
      resolvedPublicImportEntries({ ...query, specifier: "./public.ts" }, [ownerDeclaration]),
    ).toStrictEqual([ownerDeclaration]);
    expect(
      resolvedPublicImportEntries({ ...query, importedName: "SHADOW", specifier: "./public.ts" }, [
        ownerDeclaration,
      ]),
    ).toStrictEqual([]);
    expect(
      resolvedPublicImportEntries({ ...query, specifier: "./public.ts" }, [
        {
          ...ownerDeclaration,
          importRoutes: [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["src/runtime.ts"],
              specifier: "./public.ts",
            },
          ],
        },
      ]),
    ).toStrictEqual([]);
  });

  test("a consumer outside the repository cannot inherit repository compiler configuration", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();

    expect(
      repositoryModulePath({
        filename: join(dirname(repositoryRoot), "consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      }),
    ).toBeNull();
  });
});
