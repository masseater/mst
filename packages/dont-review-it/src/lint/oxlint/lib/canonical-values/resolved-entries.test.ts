import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values.test-fixture.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("resolved entries", () => {
  const buildCanonicalValuesCatalog = (options: { readonly repositoryRoot: string }) =>
    analyzeCanonicalValuesRepository(options).catalog;

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

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]).toMatchObject({
      binding: "ORDER_STATUSES",
      conceptId: "order.status",
      declarationPath: "src/order-status.ts",
      fingerprint: fingerprintValues(["draft", "published"]),
      importRoutes: [],
      packageName: null,
      values: ["draft", "published"],
    });
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

  test("positive unary numbers come from the resolved tuple type", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/retry.ts",
      contents: annotateCanonicalValues(
        "retry.outcome",
        "export const OUTCOMES = [+1, +2] as const;",
      ),
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      1, 2,
    ]);
  });

  test("checker-resolved local and imported spreads form one finite domain", () => {
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

  test("a checker-resolved conditional tuple item remains a finite domain", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = [true ? "draft" : "published", "archived"] as const;',
      ),
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "archived",
      "draft",
      "published",
    ]);
  });

  test("each owner uses its nearest TypeScript paths configuration", () => {
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
    for (const [packageName, conceptId, added] of [
      ["orders", "order.status", "published"],
      ["articles", "article.status", "review"],
    ] as const) {
      writeCanonicalValuesTestFile({
        repositoryRoot,
        relativePath: `packages/${packageName}/src/status.ts`,
        contents: `import { BASE } from "@internal/base";
${annotateCanonicalValues(conceptId, `export const STATUSES = [...BASE, "${added}"] as const;`)}`,
      });
    }

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot })
        .entries.filter((entry) => entry.conceptId.endsWith(".status"))
        .map((entry) => [entry.conceptId, entry.values]),
    ).toStrictEqual([
      ["article.status", ["review", "writing"]],
      ["order.status", ["draft", "published"]],
    ]);
  });

  test("an object binding declares its property names", () => {
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
    ["a call inside a tuple", 'export const VALUES = [buildValue(), "published"] as const;'],
    ["an unsupported unary expression", 'export const VALUES = [~1, "published"] as const;'],
    ["unary numeric coercion of a boolean", 'export const VALUES = [+true, "published"] as const;'],
    ["direct duplicate values", 'export const VALUES = ["draft", "draft"] as const;'],
    ["direct duplicate false values", "export const VALUES = [false, false] as const;"],
    [
      "an optional object key",
      "export const VALUES: { draft?: null; published: null } = { published: null };",
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
      conceptId: "order.status",
      filePath: "src/values.ts",
      kind: "vocabulary-without-values",
      line: 1,
    });
  });

  test("an unresolved computed object key creates no entry", () => {
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

    expect(analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries).toStrictEqual([]);
  });
});
