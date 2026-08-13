import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { findEquivalentConcepts, inspectCanonicalValues } from "./verify.ts";

import type { CanonicalValue } from "./fingerprint.ts";

describe("verify", () => {
  const CANONICAL_VALUES_TAG = "@canonical-values";

  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [relativePath, fileText] of Object.entries(files)) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, fileText, "utf8");
    }
    return root;
  };

  const annotatedWith = (conceptId: string, declaration: string): string =>
    `/** ${CANONICAL_VALUES_TAG} ${conceptId} */
${declaration}
`;

  const declaring = (conceptId: string, binding: string): string =>
    annotatedWith(conceptId, `export const ${binding} = ["draft"] as const;`);

  const conceptIdsOf = (
    equivalentDeclarations: readonly { readonly conceptId: string }[],
  ): readonly string[] => equivalentDeclarations.map((declaration) => declaration.conceptId);

  const verifyCanonicalValues = (inspectionRequest: { readonly repositoryRoot: string }) =>
    inspectCanonicalValues(inspectionRequest).problems;

  const buildCanonicalValuesCatalog = (inspectionRequest: { readonly repositoryRoot: string }) =>
    inspectCanonicalValues(inspectionRequest).catalog;

  const catalogPathsOf = (repositoryRoot: string): readonly string[] =>
    buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
      (declaration) => declaration.declarationPath,
    );

  test("a repository whose annotations are all well formed yields no problem", () => {
    const repositoryRoot = repositoryWith({
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
  });

  test("a concept declared in two places is rejected at the second declaration", () => {
    const repositoryRoot = repositoryWith({
      "src/a.ts": declaring("order.status", "A_STATUSES"),
      "src/b.ts": declaring("order.status", "B_STATUSES"),
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      {
        kind: "duplicate-concept",
        filePath: "src/b.ts",
        line: 1,
        conceptId: "order.status",
        declaredFilePath: "src/a.ts",
        declaredLine: 1,
      },
    ]);
  });

  test("a broken annotation inside a dot directory is reported", () => {
    const repositoryRoot = repositoryWith({
      ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
    ]);
  });

  test("duplicate owners in a dot directory and production source are both excluded", () => {
    const repositoryRoot = repositoryWith({
      ".config/hidden.ts": declaring("order.status", "HIDDEN_STATUSES"),
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(
      verifyCanonicalValues({ repositoryRoot }).map((problem) => [problem.kind, problem.filePath]),
    ).toStrictEqual([["duplicate-concept", "src/order.ts"]]);
  });

  test("a test annotation is rejected without becoming an owner", () => {
    const repositoryRoot = repositoryWith({
      "src/order.test.ts": declaring("order.status", "FIXTURE_STATUSES"),
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual(["src/order.ts"]);
    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      {
        kind: "out-of-scope-declaration",
        filePath: "src/order.test.ts",
        line: 1,
        conceptId: "order.status",
      },
    ]);
  });

  test("a retired annotation tag is rejected wherever it sits, including a test file", () => {
    const [retired] = RETIRED_ANNOTATION_TAGS;
    if (retired === undefined) throw new Error("the retired tag vocabulary must not be empty");
    const repositoryRoot = repositoryWith({
      "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
      "src/order.test.ts": `/** ${retired} */
const FIXTURE_STATUSES = ["draft"] as const;
`,
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "retired-annotation-tag", filePath: "scripts/legacy.mjs", line: 1, tag: retired },
      { kind: "retired-annotation-tag", filePath: "src/order.test.ts", line: 1, tag: retired },
    ]);
  });

  test("canonical rule suppression is rejected without requiring an annotation", () => {
    const repositoryRoot = repositoryWith({
      "src/consumer.ts":
        '// oxlint-disable-next-line dont-review-it/no-local-finite-value-set--use-or-register-canonical-values\nexport const schema = z.enum(["draft", "published"]);\n',
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
    ]);
  });

  test("canonical suppression remains rejected through a plugin alias", () => {
    const repositoryRoot = repositoryWith({
      "src/consumer.ts":
        '// oxlint-disable-next-line canonical-alias/no-strict-canonical-literal-use--use-canonical-import\nexport const status = "draft";\n',
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
    ]);
  });

  test("vendored sources under node_modules are outside the scan", () => {
    const repositoryRoot = repositoryWith({
      "node_modules/vendor/index.ts": declaring("order.status", "VENDOR_STATUSES"),
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
  });

  test("a build output directory is outside the scan", () => {
    const repositoryRoot = repositoryWith({
      "dist/order.ts": declaring("order.status", "BUILT_STATUSES"),
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
  });

  test("an external symlinked directory is a strict repository problem", () => {
    const repositoryRoot = repositoryWith({
      "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
    });
    const outside = repositoryWith({
      "vendor/status.ts": declaring("order.status", "OUTSIDE_STATUSES"),
    });
    symlinkSync(join(outside, "vendor"), join(repositoryRoot, "linked"), "dir");

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "unsafe-symbolic-link", line: 1, filePath: "linked" },
    ]);
  });

  test("a production symlink to an internal source cannot hide canonical rule suppression", () => {
    const repositoryRoot = repositoryWith({
      "dist/consumer.ts":
        '// eslint-disable-next-line -- escape\nexport const schema = z.enum(["draft", "published"]);\n',
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    symlinkSync(join(repositoryRoot, "dist/consumer.ts"), join(repositoryRoot, "src/consumer.ts"));

    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
    ]);
  });

  test("two concepts that declare the same value set are reported as one group", () => {
    const repositoryRoot = repositoryWith({
      "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    const { entries } = buildCanonicalValuesCatalog({ repositoryRoot });

    expect(
      findEquivalentConcepts(entries).map((equivalentDeclarations) =>
        conceptIdsOf(equivalentDeclarations),
      ),
    ).toStrictEqual([["article.status", "order.status"]]);
  });

  test("concepts that declare different value sets form no group", () => {
    const repositoryRoot = repositoryWith({
      "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "archived"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    const { entries } = buildCanonicalValuesCatalog({ repositoryRoot });

    expect(findEquivalentConcepts(entries)).toStrictEqual([]);
  });

  const AGREEMENT_CASES: readonly {
    readonly form: string;
    readonly conceptId: string;
    readonly declaration: string;
    readonly declared: readonly CanonicalValue[] | null;
    readonly problemKind: string | null;
  }[] = [
    {
      form: "an array",
      conceptId: "array.form",
      declaration: 'export const ARRAY_FORM = ["draft", "published"] as const;',
      declared: ["draft", "published"],
      problemKind: null,
    },
    {
      form: "an object",
      conceptId: "object.form",
      declaration:
        'export const OBJECT_FORM = { Draft: "draft", Published: "published" } as const;',
      declared: ["Draft", "Published"],
      problemKind: null,
    },
    {
      form: "a type alias",
      conceptId: "type.form",
      declaration: 'export type TypeForm = "draft" | "published";',
      declared: null,
      problemKind: "invalid-declaration",
    },
    {
      form: "an enum",
      conceptId: "enum.form",
      declaration: 'export enum EnumForm {\n  Draft = "draft",\n  Published = "published",\n}',
      declared: null,
      problemKind: "invalid-declaration",
    },
    {
      form: "a call",
      conceptId: "call.form",
      declaration: "export const CALL_FORM = buildStatuses();",
      declared: null,
      problemKind: "vocabulary-without-values",
    },
  ];

  test("the catalog and the verification read the same declarations out of the same source", () => {
    const observed = AGREEMENT_CASES.map(({ form, conceptId, declaration }) => {
      const repositoryRoot = repositoryWith({
        "src/owner.ts": annotatedWith(conceptId, declaration),
      });
      const inspection = inspectCanonicalValues({ repositoryRoot });
      return {
        form,
        catalogued: inspection.catalog.entries.map((declarationEntry) => [
          declarationEntry.declarationPath,
          declarationEntry.conceptId,
          declarationEntry.values,
        ]),
        verified: inspection.problems.map((problem) => [problem.kind, problem.filePath]),
      };
    });

    expect(observed).toStrictEqual(
      AGREEMENT_CASES.map(({ form, conceptId, declared, problemKind }) =>
        problemKind === null
          ? {
              form,
              catalogued: [["src/owner.ts", conceptId, declared]],
              verified: [],
            }
          : {
              form,
              catalogued: [],
              verified: [[problemKind, "src/owner.ts"]],
            },
      ),
    );
  });

  test("two declarations on one physical line are duplicate owners and neither is catalogued", () => {
    const repositoryRoot = repositoryWith({
      "src/status.ts":
        '/** @canonical-values order.status */ const A = ["draft"] as const; /** @canonical-values order.status */ const B = ["published"] as const;',
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      {
        kind: "duplicate-concept",
        filePath: "src/status.ts",
        line: 1,
        conceptId: "order.status",
        declaredFilePath: "src/status.ts",
        declaredLine: 1,
      },
    ]);
  });

  test("story fixture and test annotations are strict problems and never owners", () => {
    const repositoryRoot = repositoryWith({
      "fixtures/status.ts": declaring("fixture.status", "FIXTURE_STATUSES"),
      "src/Order.stories.ts": declaring("story.status", "STORY_STATUSES"),
      "src/order.test.ts": declaring("test.status", "TEST_STATUSES"),
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(
      verifyCanonicalValues({ repositoryRoot }).map((problem) => [problem.kind, problem.filePath]),
    ).toStrictEqual([
      ["out-of-scope-declaration", "fixtures/status.ts"],
      ["out-of-scope-declaration", "src/Order.stories.ts"],
      ["out-of-scope-declaration", "src/order.test.ts"],
    ]);
  });

  test("if nested intervening and re-export annotations are strict problems", () => {
    const repositoryRoot = repositoryWith({
      "src/if.ts": '/** @canonical-values fake.if */\nif (true) consume("draft");\n',
      "src/intervening.ts":
        '/** @canonical-values fake.intervening */\n/** display order */\nexport const VALUES = ["draft"] as const;\n',
      "src/nested.ts":
        'export function load() {\n  /** @canonical-values fake.nested */\n  return "draft";\n}\nexport const BAIT = ["published"] as const;\n',
      "src/re-export.ts":
        '/** @canonical-values fake.re-export */\nexport { VALUES } from "./values.ts";\n',
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(
      verifyCanonicalValues({ repositoryRoot }).map((problem) => [
        problem.kind,
        problem.filePath,
        problem.kind === "invalid-declaration" ? problem.reason : null,
      ]),
    ).toStrictEqual([
      ["invalid-declaration", "src/if.ts", "variable-statement-required"],
      ["invalid-declaration", "src/intervening.ts", "adjacent-declaration-required"],
      ["invalid-declaration", "src/nested.ts", "module-scope-required"],
      ["invalid-declaration", "src/re-export.ts", "variable-statement-required"],
    ]);
  });

  test("an unsupported resolved value domain is a strict problem without a catalog entry", () => {
    const repositoryRoot = repositoryWith({
      "src/status.ts": annotatedWith("order.status", "export const VALUES = buildStatuses();"),
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      {
        kind: "vocabulary-without-values",
        filePath: "src/status.ts",
        line: 1,
        conceptId: "order.status",
      },
    ]);
  });

  test("an unterminated annotated comment is a strict problem without a catalog entry", () => {
    const repositoryRoot = repositoryWith({
      "src/status.ts": "/** @canonical-values order.status",
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
      { kind: "unparsable-source", filePath: "src/status.ts", line: 1 },
    ]);
  });

  test("ambient TypeScript sources cannot supply a runtime owner", () => {
    const ambient = annotatedWith(
      "order.status",
      'export declare const ORDER_STATUSES: readonly ["draft", "published"];',
    );
    const repositoryRoot = repositoryWith({
      "src/order.d.ts": ambient,
      "src/order.ts": ambient,
    });

    expect(catalogPathsOf(repositoryRoot)).toStrictEqual([]);
    expect(
      verifyCanonicalValues({ repositoryRoot }).map((problem) => [
        problem.kind,
        problem.filePath,
        problem.kind === "invalid-declaration" ? problem.reason : null,
      ]),
    ).toStrictEqual([
      ["invalid-declaration", "src/order.d.ts", "runtime-initializer-required"],
      ["invalid-declaration", "src/order.ts", "runtime-initializer-required"],
    ]);
  });
});
