import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository, loadCanonicalValuesCatalogSnapshot } from "./builder.ts";

const createCanonicalValuesTestRepository = (): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  return repositoryRoot;
};

const writeCanonicalValuesTestFile = ({
  repositoryRoot,
  relativePath,
  contents: fileText,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly contents: string;
}): void => {
  const absolutePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, fileText, "utf8");
};

const annotateCanonicalValues = (conceptId: string, declaration: string): string =>
  `/** @canonical-values ${conceptId} */\n${declaration}\n`;

describe("builder", () => {
  test("public routes preserve the exact exported symbol and alias", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/package.json",
      contents: JSON.stringify({
        name: "@fixture/vocabulary",
        exports: {
          ".": "./src/index.ts",
          "./alias": "./src/alias.ts",
          "./shadow": "./src/shadow.ts",
        },
      }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/index.ts",
      contents: 'export { ORDER_STATUSES } from "./order-status.ts";\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/alias.ts",
      contents: 'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./order-status.ts";\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/shadow.ts",
      contents: 'export const SHADOW_STATUSES = ["draft", "published"] as const;\n',
    });

    expect(
      analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries[0]?.importRoutes,
    ).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
        specifier: "@fixture/vocabulary",
      },
      {
        exportName: "PUBLIC_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/alias.ts"],
        specifier: "@fixture/vocabulary/alias",
      },
    ]);
  });

  test("a package owner keeps its package identity when no public route reaches it", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/package.json",
      contents: JSON.stringify({
        name: "@fixture/vocabulary",
        exports: { ".": "./src/index.ts" },
      }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/index.ts",
      contents: 'export const SHADOW_STATUSES = ["draft", "published"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    expect(analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries[0]).toMatchObject({
      importRoutes: [],
      packageName: "@fixture/vocabulary",
    });
  });

  test("a JavaScript export target resolves to its TypeScript source before generated output", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/package.json",
      contents: JSON.stringify({
        name: "@fixture/vocabulary",
        exports: { ".": "./src/index.js" },
      }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/index.js",
      contents: 'export const ORDER_STATUSES = ["shadow"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/index.ts",
      contents: 'export { ORDER_STATUSES } from "./order-status.ts";\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    expect(
      analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries[0]?.importRoutes,
    ).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
        specifier: "@fixture/vocabulary",
      },
    ]);
  });

  test("a malformed package surface becomes a strict problem instead of crashing lenient build", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/package.json",
      contents: "{not json\n",
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/vocabulary/src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    expect(analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries).toStrictEqual([]);
    expect(analyzeCanonicalValuesRepository({ repositoryRoot }).problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "packages/vocabulary/src/order-status.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test("out-of-scope annotations become problems without becoming owners", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/Owner.stories.fixture.ts",
      contents: annotateCanonicalValues(
        "story.status",
        'export const STATUSES = ["draft"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order.test.helper.ts",
      contents: annotateCanonicalValues(
        "test.status",
        'export const TEST_STATUSES = ["tested"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order.test-d.ts",
      contents: annotateCanonicalValues(
        "type-test.status",
        'export const TYPE_TEST_STATUSES = ["typed"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "fixtures/order.ts",
      contents: annotateCanonicalValues(
        "fixture.status",
        'export const STATUSES = ["published"] as const;',
      ),
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems.map((problem) => [problem.kind, problem.filePath])).toStrictEqual([
      ["out-of-scope-declaration", "fixtures/order.ts"],
      ["out-of-scope-declaration", "src/Owner.stories.fixture.ts"],
      ["out-of-scope-declaration", "src/order.test-d.ts"],
      ["out-of-scope-declaration", "src/order.test.helper.ts"],
    ]);
  });

  test("ambient and declaration-file annotations cannot become runtime owners", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const ambient = annotateCanonicalValues(
      "order.status",
      'export declare const ORDER_STATUSES: readonly ["draft", "published"];',
    );
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.d.ts",
      contents: ambient,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: ambient,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems.map((problem) => [problem.kind, problem.filePath])).toStrictEqual([
      ["invalid-declaration", "src/order-status.d.ts"],
      ["invalid-declaration", "src/order-status.ts"],
    ]);
  });

  test("every declaration in a duplicate concept collision is excluded", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "package.json",
      contents: JSON.stringify({ name: "@fixture/repository" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/a.ts",
      contents: annotateCanonicalValues("order.status", 'export const A = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/b.ts",
      contents: annotateCanonicalValues("order.status", 'export const B = ["published"] as const;'),
    });

    const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;

    expect(catalog.entries).toStrictEqual([]);
    expect(catalog.packageNames).toStrictEqual(new Set(["@fixture/repository"]));
  });

  test("the lint snapshot remains immutable for the lifetime of the process", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    const first = loadCanonicalValuesCatalogSnapshot({ repositoryRoot });

    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["final"] as const;',
      ),
    });

    const snapshot = loadCanonicalValuesCatalogSnapshot({ repositoryRoot });

    expect(snapshot).toBe(first);
    expect(snapshot.entries[0]?.values).toStrictEqual(["draft"]);
  });

  test("a second lexical root for one repository reuses its disk cache", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const linkedRoot = join(createCanonicalValuesTestRepository(), "repository");
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    const first = loadCanonicalValuesCatalogSnapshot({ repositoryRoot });
    symlinkSync(repositoryRoot, linkedRoot, "dir");

    const cached = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: linkedRoot });

    expect(cached).not.toBe(first);
    expect(cached.entries).toStrictEqual(first.entries);
  });

  test("an unsafe symbolic link prevents a catalog entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const externalRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot: externalRoot,
      relativePath: "external.ts",
      contents: 'export const EXTERNAL = "draft";\n',
    });
    symlinkSync(join(externalRoot, "external.ts"), join(repositoryRoot, "src/external.ts"));

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.problems).toContainEqual({
      kind: "unsafe-symbolic-link",
      filePath: "src/external.ts",
      line: 1,
    });
    expect(analyzed.catalog.entries).toStrictEqual([]);
  });

  test("a missing repository root yields an empty catalog and creates nothing", () => {
    const repositoryRoot = join(createCanonicalValuesTestRepository(), "missing");

    expect(loadCanonicalValuesCatalogSnapshot({ repositoryRoot }).entries).toStrictEqual([]);
    expect(existsSync(repositoryRoot)).toBe(false);
  });
});
