import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

describe("declarations", () => {
  const CANONICAL_VALUES_TAG = "@canonical-values";

  const identitiesIn = (sourceText: string): readonly unknown[] =>
    scanCanonicalValuesText(sourceText).declarations.map((declaration) => ({
      binding: declaration.binding,
      conceptId: declaration.conceptId,
      line: declaration.line,
    }));

  test("a directly annotated module variable is a declaration candidate", () => {
    expect(
      identitiesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`),
    ).toStrictEqual([{ binding: "ORDER_STATUSES", conceptId: "order.status", line: 1 }]);
  });

  test("blank lines keep a JSDoc annotation directly attached", () => {
    expect(
      identitiesIn(`/** ${CANONICAL_VALUES_TAG} order.status */

export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([{ binding: "ORDER_STATUSES", conceptId: "order.status", line: 1 }]);
  });

  test("a line comment cannot declare a canonical owner", () => {
    expect(
      scanCanonicalValuesText(`// ${CANONICAL_VALUES_TAG} order.status
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "jsdoc-required" }],
    });
  });

  test("a plain block comment cannot declare a canonical owner", () => {
    expect(
      scanCanonicalValuesText(`/* ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "jsdoc-required" }],
    });
  });

  test.each([
    ["an if statement", 'if (true) consume("draft");'],
    ["a call", 'consume("draft");'],
    ["an import", 'import { value } from "draft";'],
    ["a re-export", 'export { value } from "./value.ts";'],
    ["a type alias", 'export type Status = "draft" | "published";'],
    ["an enum", 'export enum Status { Draft = "draft" }'],
    ["a function", "export function status() { return 'draft'; }"],
    ["a class", "export class Status {}"],
  ])("%s cannot become an owner", (_name, statement) => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
${statement}
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "variable-statement-required" }],
    });
  });

  test("a nested annotation cannot capture a later module declaration", () => {
    expect(
      scanCanonicalValuesText(`export function load() {
  /** ${CANONICAL_VALUES_TAG} fake.owner */
  return "draft";
}
export const BAIT = ["published"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 2, reason: "module-scope-required" }],
    });
  });

  test("another comment between the annotation and variable breaks direct attachment", () => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
/** display order */
export const ORDER_STATUSES = ["draft", "published"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "adjacent-declaration-required" }],
    });
  });

  test("a variable statement must contain one identifier binding", () => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const DRAFT = "draft", PUBLISHED = "published";
/** ${CANONICAL_VALUES_TAG} article.status */
export const { status } = article;
`),
    ).toMatchObject({
      declarations: [],
      problems: [
        { kind: "invalid-declaration", line: 1, reason: "single-binding-required" },
        { kind: "invalid-declaration", line: 3, reason: "identifier-binding-required" },
      ],
    });
  });

  test("one JSDoc cannot declare more than one canonical concept", () => {
    expect(
      scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${CANONICAL_VALUES_TAG} article.status
 */
export const STATUSES = ["draft"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "single-annotation-required" }],
    });
  });

  test("a malformed second tag cannot hide behind tab whitespace", () => {
    expect(
      scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${CANONICAL_VALUES_TAG}\tarticle.status
 */
export const STATUSES = ["draft"] as const;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "single-annotation-required" }],
    });
  });

  test("an ambient variable cannot become a runtime owner", () => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export declare const ORDER_STATUSES: readonly ["draft", "published"];
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "runtime-initializer-required" }],
    });
  });

  test("two declarations on one physical line remain distinct occurrences", () => {
    const scanned = scanCanonicalValuesText(
      `/** ${CANONICAL_VALUES_TAG} order.status */ const A = ["draft"] as const; /** ${CANONICAL_VALUES_TAG} order.status */ const B = ["published"] as const;`,
    );

    expect(scanned.declarations.map((declaration) => declaration.binding)).toStrictEqual([
      "A",
      "B",
    ]);
    expect(scanned.declarations[0]?.declarationStart).not.toBe(
      scanned.declarations[1]?.declarationStart,
    );
  });

  test("a tag without a concept is reported", () => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual({
      declarations: [],
      problems: [{ kind: "unparsable-annotation", line: 1 }],
    });
  });

  test("a valid annotation without a following statement is rejected", () => {
    expect(scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */`)).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "variable-statement-required" }],
    });
  });

  test("a variable without a runtime initializer is rejected", () => {
    expect(
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
let ORDER_STATUSES;
`),
    ).toMatchObject({
      declarations: [],
      problems: [{ kind: "invalid-declaration", line: 1, reason: "runtime-initializer-required" }],
    });
  });

  test("an unterminated annotated comment is a strict parse problem", () => {
    expect(scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status`)).toStrictEqual({
      declarations: [],
      problems: [{ kind: "unparsable-source", line: 1 }],
    });
  });

  test("a retired annotation tag prevents the same comment from becoming an owner", () => {
    const retired = RETIRED_ANNOTATION_TAGS[0];
    if (retired === undefined) throw new Error("the retired tag vocabulary must not be empty");

    const scanned = scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${retired}
 */
export const ORDER_STATUSES = ["draft"] as const;
`);

    expect(scanned.declarations).toStrictEqual([]);
    expect(scanned.problems).toContainEqual({
      kind: "retired-annotation-tag",
      line: 3,
      tag: retired,
    });
  });

  test("a canonical rule cannot be suppressed by an oxlint directive", () => {
    expect(
      scanCanonicalValuesText(
        '// oxlint-disable-next-line dont-review-it/no-strict-canonical-literal-use--use-canonical-import\nconst status = "draft";\n',
      ).problems,
    ).toStrictEqual([{ kind: "canonical-rule-suppression", line: 1 }]);
  });

  test.each([
    "canonical-alias/no-strict-canonical-literal-use--use-canonical-import",
    "canonical-alias(no-local-finite-value-set--use-or-register-canonical-values)",
  ])("a plugin alias cannot hide a canonical suppression", (ruleName) => {
    expect(
      scanCanonicalValuesText(`// oxlint-disable-next-line ${ruleName}\nconst status = "draft";\n`)
        .problems,
    ).toStrictEqual([{ kind: "canonical-rule-suppression", line: 1 }]);
  });

  test("a directive that disables every rule cannot suppress canonical checks", () => {
    expect(scanCanonicalValuesText("/* oxlint-disable */\n").problems).toStrictEqual([
      { kind: "canonical-rule-suppression", line: 1 },
    ]);
  });

  test("a line directive without a rule list cannot suppress canonical checks", () => {
    expect(
      scanCanonicalValuesText("// oxlint-disable-next-line\nconst status = 'draft';\n").problems,
    ).toStrictEqual([{ kind: "canonical-rule-suppression", line: 1 }]);
  });

  test("an eslint-compatible directive cannot suppress a canonical rule", () => {
    expect(
      scanCanonicalValuesText(
        '// eslint-disable-next-line dont-review-it/no-local-finite-value-set--use-or-register-canonical-values -- forbidden escape\nconst schema = z.enum(["draft", "published"]);\n',
      ).problems,
    ).toStrictEqual([{ kind: "canonical-rule-suppression", line: 1 }]);
  });

  test.each([
    "// eslint-disable-next-line -- forbidden escape\nconst status = 'draft';\n",
    "// oxlint-disable-next-line -- forbidden escape\nconst status = 'draft';\n",
    "const status = 'draft'; // eslint-disable-line -- forbidden escape\n",
    "const status = 'draft'; // oxlint-disable-line -- forbidden escape\n",
    "/* eslint-disable -- forbidden escape */\n",
    "/* oxlint-disable -- forbidden escape */\n",
  ])(
    "a reason cannot turn a rule-list-free directive into an unrelated suppression",
    (sourceText) => {
      expect(scanCanonicalValuesText(sourceText).problems).toStrictEqual([
        { kind: "canonical-rule-suppression", line: 1 },
      ]);
    },
  );

  test("a directive targeting an unrelated rule is not a canonical suppression", () => {
    expect(
      scanCanonicalValuesText("// oxlint-disable-next-line no-console\nconsole.log(1);\n"),
    ).toStrictEqual({ declarations: [], problems: [] });
  });

  test("an unrelated rule name containing two hyphens stays unrelated", () => {
    expect(
      scanCanonicalValuesText(
        "// eslint-disable-next-line fixture/no-console--with-reason -- unrelated reason\nconsole.log(1);\n",
      ),
    ).toStrictEqual({ declarations: [], problems: [] });
  });

  test("annotation spellings inside literals are not comments", () => {
    expect(
      scanCanonicalValuesText(`export const TAG = "${CANONICAL_VALUES_TAG}";
export const EXAMPLE = \`/** ${CANONICAL_VALUES_TAG} doc.example */\`;
`),
    ).toStrictEqual({ declarations: [], problems: [] });
  });
});
