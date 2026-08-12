import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog } from "./builder.ts";
import { importRouteStatus } from "./import-route.ts";

const writeRepositoryFile = ({
  contents,
  relativePath,
  root,
}: {
  readonly contents: string;
  readonly relativePath: string;
  readonly root: string;
}): void => {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
};

const createPackageRepository = (
  exportsField: unknown,
  extraFiles: Readonly<Record<string, string>> = {},
): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  writeRepositoryFile({
    contents: JSON.stringify({ name: "@fixture/vocabulary", exports: exportsField }),
    relativePath: "packages/vocabulary/package.json",
    root,
  });
  writeRepositoryFile({
    contents:
      '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
    relativePath: "packages/vocabulary/src/order-status.ts",
    root,
  });
  for (const relativePath of ["src/index.ts", "src/require.ts"]) {
    writeRepositoryFile({
      contents: 'export { ORDER_STATUSES } from "./order-status.ts";\n',
      relativePath: `packages/vocabulary/${relativePath}`,
      root,
    });
  }
  writeRepositoryFile({
    contents: 'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
    relativePath: "packages/vocabulary/src/shadow.ts",
    root,
  });
  writeRepositoryFile({
    contents: 'import { ORDER_STATUSES } from "./order-status.ts";\nexport = ORDER_STATUSES;\n',
    relativePath: "packages/vocabulary/src/module.ts",
    root,
  });
  writeRepositoryFile({
    contents: 'const ORDER_STATUSES = ["draft", "published"] as const;\nexport = ORDER_STATUSES;\n',
    relativePath: "packages/vocabulary/src/module-shadow.ts",
    root,
  });
  writeRepositoryFile({
    contents: 'export { ORDER_STATUSES } from "../order-status.ts";\n',
    relativePath: "packages/vocabulary/src/public/owner.ts",
    root,
  });
  writeRepositoryFile({
    contents: 'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
    relativePath: "packages/vocabulary/src/public/shadow.ts",
    root,
  });
  for (const [relativePath, contents] of Object.entries(extraFiles)) {
    writeRepositoryFile({ contents, relativePath, root });
  }
  return root;
};

const importRoutesFor = (
  exportsField: unknown,
  extraFiles?: Readonly<Record<string, string>>,
): readonly unknown[] =>
  buildCanonicalValuesCatalog({
    repositoryRoot: createPackageRepository(exportsField, extraFiles),
  }).entries[0]?.importRoutes ?? [];

describe("export specifier index", () => {
  test("an export-equals owner publishes the package module value", () => {
    expect(
      importRoutesFor({
        ".": "./src/module.ts",
        "./shadow": "./src/module-shadow.ts",
      }),
    ).toStrictEqual([
      {
        exportName: "<module>",
        resolvedSourcePaths: ["packages/vocabulary/src/module.ts"],
        specifier: "@fixture/vocabulary",
      },
    ]);
  });

  test("a single-star export pattern expands only owner source identities", () => {
    expect(importRoutesFor({ "./*": "./src/public/*.ts" })).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
        specifier: "@fixture/vocabulary/owner",
      },
    ]);
  });

  test("an exact null export overrides a matching wildcard route", () => {
    expect(
      importRoutesFor({
        "./owner": null,
        "./*": "./src/public/*.ts",
      }),
    ).toStrictEqual([]);
  });

  test("an exact shadow export overrides a matching wildcard owner route", () => {
    expect(
      importRoutesFor({
        "./owner": "./src/shadow.ts",
        "./*": "./src/public/*.ts",
      }),
    ).toStrictEqual([]);
  });

  test("a more specific null pattern overrides a matching broad wildcard route", () => {
    const expected = [
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
        specifier: "@fixture/vocabulary/owner",
      },
    ];
    const extraFiles = {
      "packages/vocabulary/src/public/private/status.ts":
        'export { ORDER_STATUSES } from "../../order-status.ts";\n',
    };
    for (const exportsField of [
      {
        "./private/*": null,
        "./*": "./src/public/*.ts",
      },
      {
        "./*": "./src/public/*.ts",
        "./private/*": null,
      },
    ]) {
      expect(importRoutesFor(exportsField, extraFiles)).toStrictEqual(expected);
    }
  });

  test("a pattern capture comes from the existing target path", () => {
    expect(importRoutesFor({ "./*": "./src/public/*" })).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
        specifier: "@fixture/vocabulary/owner.ts",
      },
    ]);
  });

  test("a pattern whose target has no repository file publishes no route", () => {
    expect(importRoutesFor({ "./*": "./src/missing/*.ts" })).toStrictEqual([]);
  });

  test("a JavaScript target pattern resolves its corresponding TypeScript source", () => {
    expect(importRoutesFor({ "./*": "./src/public/*.js" })).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
        specifier: "@fixture/vocabulary/owner",
      },
    ]);
  });

  test("a subpath with multiple stars publishes no route", () => {
    expect(importRoutesFor({ "./**": "./src/public/*.ts" })).toStrictEqual([]);
  });

  test("a target with multiple stars publishes no route", () => {
    expect(importRoutesFor({ "./*": "./src/**/index.*" })).toStrictEqual([]);
  });

  test("a pattern target outside the package publishes no route", () => {
    expect(importRoutesFor({ "./*": "../public/*.ts" })).toStrictEqual([]);
  });

  test("a package target symlinked outside the package publishes no route", () => {
    const root = createPackageRepository({ ".": "./src/public-link.ts" });
    writeRepositoryFile({
      contents: 'export { ORDER_STATUSES } from "../packages/vocabulary/src/order-status.ts";\n',
      relativePath: "shared/index.ts",
      root,
    });
    symlinkSync("../../../shared/index.ts", join(root, "packages/vocabulary/src/public-link.ts"));

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot: root }).entries[0]?.importRoutes,
    ).toStrictEqual([]);
  });

  test("a pattern target without a capture publishes no route", () => {
    expect(importRoutesFor({ "./*": "./src/public/owner.ts" })).toStrictEqual([]);
  });

  test("a conditional route is rejected when one runtime target exports a shadow", () => {
    expect(
      importRoutesFor({
        ".": {
          import: "./src/shadow.ts",
          require: "./src/index.ts",
        },
      }),
    ).toStrictEqual([]);
  });

  test("a conditional route keeps an export shared by every runtime target", () => {
    expect(
      importRoutesFor({
        ".": {
          import: "./src/index.ts",
          require: "./src/require.ts",
        },
      }),
    ).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: [
          "packages/vocabulary/src/index.ts",
          "packages/vocabulary/src/require.ts",
        ],
        specifier: "@fixture/vocabulary",
      },
    ]);
  });

  test("an unresolved runtime condition fails closed even when default reaches the owner", () => {
    expect(
      importRoutesFor({
        ".": {
          browser: "./src/missing.ts",
          default: "./src/index.ts",
        },
      }),
    ).toStrictEqual([]);
  });

  test("an export fallback stops at the first resolvable shadow target", () => {
    expect(importRoutesFor({ ".": ["./src/shadow.ts", "./src/index.ts"] })).toStrictEqual([]);
  });

  test("an export fallback reaches the owner after an unresolved target", () => {
    expect(importRoutesFor({ ".": ["./src/missing.ts", "./src/index.ts"] })).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
        specifier: "@fixture/vocabulary",
      },
    ]);
  });

  test("a workspace package types condition resolves to its registered runtime route", () => {
    const root = mkdtempSync(join(tmpdir(), "canonical-public-route-types-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const files = {
      "package.json": JSON.stringify({
        name: "fixture-repository",
        private: true,
        workspaces: ["packages/*"],
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
      }),
      "packages/vocabulary/package.json": JSON.stringify({
        name: "@fixture/vocabulary",
        type: "module",
        exports: {
          ".": {
            types: "./src/index.d.ts",
            import: "./src/index.ts",
            default: "./src/index.ts",
          },
        },
      }),
      "packages/vocabulary/src/owner.ts":
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
      "packages/vocabulary/src/index.d.ts":
        'export declare const ORDER_STATUSES: readonly ["draft", "published"];\n',
      "src/consumer.ts": "export {};\n",
    };
    for (const [relativePath, contents] of Object.entries(files)) {
      writeRepositoryFile({ contents, relativePath, root });
    }
    const packageLink = join(root, "node_modules/@fixture/vocabulary");
    mkdirSync(dirname(packageLink), { recursive: true });
    symlinkSync("../../packages/vocabulary", packageLink, "dir");
    const publicCatalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

    expect(
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@fixture/vocabulary",
          filename: join(root, "src/consumer.ts"),
          repositoryRoot: root,
        },
        publicCatalog,
      ),
    ).toBe("registered");
  });
});
