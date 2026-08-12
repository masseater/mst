import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository, buildCanonicalValuesCatalog } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("resolved entries", () => {
  test("an annotated array becomes one binding-aware catalog entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    const catalog = buildCanonicalValuesCatalog({ repositoryRoot });

    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]).toMatchObject({
      binding: "ORDER_STATUSES",
      conceptId: "order.status",
      declarationPath: "src/order-status.ts",
      importRoutes: [],
      packageName: null,
      values: ["draft", "published"],
      fingerprint: fingerprintValues(["draft", "published"]),
    });
    expect(catalog.entries[0]?.declarationStart).toBeTypeOf("number");
    expect(catalog.entries[0]?.declarationEnd).toBeTypeOf("number");
  });

  test("negative numbers, booleans, and null come from the resolved tuple type", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/retry.ts",
      contents: annotateCanonicalValues(
        "retry.outcome",
        "export const OUTCOMES = [-1, 1, true, null] as const;",
      ),
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      true,
      null,
      -1,
      1,
    ]);
  });

  test("a spread tuple is resolved as one complete literal domain", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `${annotateCanonicalValues(
        "base.status",
        'const BASE_STATUSES = ["draft"] as const;',
      )}
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE_STATUSES, "published"] as const;',
)}`,
    });

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["draft", "published"]);
  });

  test("a spread cannot hide directly repeated primitive values", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `const BASE_STATUSES = ["base"] as const;
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE_STATUSES, "draft", "draft"] as const;',
)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/order-status.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("an imported tuple is resolved through the TypeScript checker", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: annotateCanonicalValues("base.status", 'export const BASE = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "./base.ts";
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE, "published"] as const;',
)}`,
    });

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["draft", "published"]);
  });

  test("an imported tuple is resolved through the repository tsconfig paths mapping", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "tsconfig.json",
      contents: JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["src/base.ts"] } },
      }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: annotateCanonicalValues("base.status", 'export const BASE = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "@internal/base";
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE, "published"] as const;',
)}`,
    });

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["draft", "published"]);
  });

  test("each owner uses the nearest package tsconfig for the same alias", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    for (const packageName of ["orders", "articles"]) {
      writeCanonicalValuesTestFile({
        repositoryRoot,
        relativePath: `packages/${packageName}/tsconfig.json`,
        contents: JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["src/base.ts"] } },
        }),
      });
    }
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/orders/src/base.ts",
      contents: annotateCanonicalValues("order.base", 'export const BASE = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/articles/src/base.ts",
      contents: annotateCanonicalValues(
        "article.base",
        'export const BASE = ["writing"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/orders/src/status.ts",
      contents: `import { BASE } from "@internal/base";
${annotateCanonicalValues(
  "order.status",
  'export const STATUSES = [...BASE, "published"] as const;',
)}`,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "packages/articles/src/status.ts",
      contents: `import { BASE } from "@internal/base";
${annotateCanonicalValues(
  "article.status",
  'export const STATUSES = [...BASE, "review"] as const;',
)}`,
    });

    const entries = buildCanonicalValuesCatalog({ repositoryRoot }).entries.filter((entry) =>
      entry.conceptId.endsWith(".status"),
    );
    expect(entries.map((entry) => [entry.conceptId, entry.values])).toStrictEqual([
      ["article.status", ["review", "writing"]],
      ["order.status", ["draft", "published"]],
    ]);
  });

  test("an object binding declares its property names rather than nested initializer values", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUS = { draft: { label: "Draft" }, published: null } as const;',
      ),
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "draft",
      "published",
    ]);
  });

  test.each([
    ["an empty tuple", "export const VALUES = [] as const;"],
    ["a widened array", 'export const VALUES = ["draft", "published"];'],
    ["a scalar", 'export const VALUES = "draft" as const;'],
    ["a call result", "export const VALUES = buildValues();"],
    ["direct duplicate values", 'export const VALUES = ["draft", "draft"] as const;'],
    ["unary plus duplicate values", "export const VALUES = [+1, 1] as const;"],
    ["nested sign duplicate values", "export const VALUES = [-+1, -1] as const;"],
    ["non-null duplicate values", "export const VALUES = [1!, 1] as const;"],
    [
      "conditional result duplicate values",
      'export const VALUES = enabled ? (["draft", "draft"] as const) : (["published"] as const);',
    ],
    [
      "sequence result duplicate values",
      'export const VALUES = (sideEffect(), ["draft", "draft"] as const);',
    ],
    [
      "inline spread duplicate values",
      'export const VALUES = [...(["draft", "draft"] as const), "published"] as const;',
    ],
    ["direct duplicate object keys", "export const VALUES = { draft: 0, draft: 1 } as const;"],
    ["unary plus duplicate object keys", "export const VALUES = { [+1]: 0, 1: 1 } as const;"],
    [
      "equivalent computed and plain object keys",
      'export const VALUES = { draft: 0, ["draft"]: 1 } as const;',
    ],
    [
      "conditional result duplicate object keys",
      "export const VALUES = enabled ? ({ draft: 0, draft: 1 } as const) : ({ published: 1 } as const);",
    ],
    [
      "inline spread duplicate object keys",
      "export const VALUES = { ...{ draft: 0 }, draft: 1, published: 2 } as const;",
    ],
  ])("%s creates a strict problem and no catalog entry", (_name, declaration) => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: annotateCanonicalValues("order.status", declaration),
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test("a computed local constant cannot hide a duplicate object key", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `const KEY = "draft" as const;
${annotateCanonicalValues(
  "order.status",
  "export const VALUES = { [KEY]: 0, draft: 1 } as const;",
)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("a resolved local constant cannot hide a duplicate array value", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `const DRAFT = "draft" as const;
${annotateCanonicalValues("order.status", 'export const VALUES = [DRAFT, "draft"] as const;')}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test.each([
    {
      kind: "array",
      base: 'const BASE = ["draft"] as const;',
      declaration: 'export const VALUES = [...BASE, "draft", "published"] as const;',
    },
    {
      kind: "object",
      base: "const BASE = { draft: 0 } as const;",
      declaration: "export const VALUES = { ...BASE, draft: 1, published: 2 } as const;",
    },
  ])("a resolved $kind spread cannot hide a duplicate value", ({ base, declaration }) => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `${base}\n${annotateCanonicalValues("order.status", declaration)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("an unregistered computed local constant cannot supply a canonical object key", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `const KEY = "draft" as const;
${annotateCanonicalValues(
  "order.status",
  "export const VALUES = { [KEY]: 0, published: 1 } as const;",
)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("an unresolved computed object key creates a strict problem and no catalog entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `declare function runtimeKey(): string;
const KEY = runtimeKey();
${annotateCanonicalValues(
  "order.status",
  "export const VALUES = { [KEY]: 0, published: 1 } as const;",
)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 3,
      conceptId: "order.status",
    });
  });
});
