import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

describe("scanCanonicalValuesText", () => {
  describe("a JSDoc annotation sitting directly on a module variable", () => {
    const it = test.extend("scanOfAnAnnotatedModuleVariable", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`));

    it("makes that variable a declaration candidate", ({ scanOfAnAnnotatedModuleVariable }) => {
      expect(scanOfAnAnnotatedModuleVariable).toStrictEqual({
        declarations: [
          {
            binding: "ORDER_STATUSES",
            bindingStart: 51,
            conceptId: "order.status",
            line: 1,
            annotationStart: 0,
            declarationStart: 38,
            declarationEnd: 100,
          },
        ],
        problems: [],
      });
    });
  });

  describe("a blank line between the annotation and the variable", () => {
    const it = test.extend("scanOfAnAnnotationSeparatedByABlankLine", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */

export const ORDER_STATUSES = ["draft"] as const;
`));

    it("keeps the annotation directly attached", ({ scanOfAnAnnotationSeparatedByABlankLine }) => {
      expect(scanOfAnAnnotationSeparatedByABlankLine).toStrictEqual({
        declarations: [
          {
            binding: "ORDER_STATUSES",
            bindingStart: 52,
            conceptId: "order.status",
            line: 1,
            annotationStart: 0,
            declarationStart: 39,
            declarationEnd: 88,
          },
        ],
        problems: [],
      });
    });
  });

  describe("a line comment carrying the annotation", () => {
    const it = test.extend("scanOfALineCommentCarryingTheAnnotation", () =>
      scanCanonicalValuesText(`// ${CANONICAL_VALUES_TAG} order.status
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("cannot declare a canonical owner", ({ scanOfALineCommentCarryingTheAnnotation }) => {
      expect(scanOfALineCommentCarryingTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "jsdoc-required",
          },
        ],
      });
    });
  });

  describe("a plain block comment carrying the annotation", () => {
    const it = test.extend("scanOfAPlainBlockCommentCarryingTheAnnotation", () =>
      scanCanonicalValuesText(`/* ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("cannot declare a canonical owner", ({ scanOfAPlainBlockCommentCarryingTheAnnotation }) => {
      expect(scanOfAPlainBlockCommentCarryingTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "jsdoc-required",
          },
        ],
      });
    });
  });

  describe("an if statement under the annotation", () => {
    const it = test.extend("scanOfAnIfStatementUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
if (true) consume("draft");
`));

    it("cannot become an owner", ({ scanOfAnIfStatementUnderTheAnnotation }) => {
      expect(scanOfAnIfStatementUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("a call under the annotation", () => {
    const it = test.extend("scanOfACallUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
consume("draft");
`));

    it("cannot become an owner", ({ scanOfACallUnderTheAnnotation }) => {
      expect(scanOfACallUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("an import under the annotation", () => {
    const it = test.extend("scanOfAnImportUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
import { value } from "draft";
`));

    it("cannot become an owner", ({ scanOfAnImportUnderTheAnnotation }) => {
      expect(scanOfAnImportUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("a re-export under the annotation", () => {
    const it = test.extend("scanOfAReExportUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
export { value } from "./value.ts";
`));

    it("cannot become an owner", ({ scanOfAReExportUnderTheAnnotation }) => {
      expect(scanOfAReExportUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("a type alias under the annotation", () => {
    const it = test.extend("scanOfATypeAliasUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
export type Status = "draft" | "published";
`));

    it("cannot become an owner", ({ scanOfATypeAliasUnderTheAnnotation }) => {
      expect(scanOfATypeAliasUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("an enum under the annotation", () => {
    const it = test.extend("scanOfAnEnumUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
export enum Status { Draft = "draft" }
`));

    it("cannot become an owner", ({ scanOfAnEnumUnderTheAnnotation }) => {
      expect(scanOfAnEnumUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("a function under the annotation", () => {
    const it = test.extend("scanOfAFunctionUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
export function status() { return "draft"; }
`));

    it("cannot become an owner", ({ scanOfAFunctionUnderTheAnnotation }) => {
      expect(scanOfAFunctionUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("a class under the annotation", () => {
    const it = test.extend("scanOfAClassUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} fake.owner */
export class Status {}
`));

    it("cannot become an owner", ({ scanOfAClassUnderTheAnnotation }) => {
      expect(scanOfAClassUnderTheAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "fake.owner",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("an annotation nested inside a function body", () => {
    const it = test.extend("scanOfANestedAnnotation", () =>
      scanCanonicalValuesText(`export function load() {
  /** ${CANONICAL_VALUES_TAG} fake.owner */
  return "draft";
}
export const BAIT = ["published"] as const;
`));

    it("cannot capture a later module declaration", ({ scanOfANestedAnnotation }) => {
      expect(scanOfANestedAnnotation).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 2,
            conceptId: "fake.owner",
            reason: "module-scope-required",
          },
        ],
      });
    });
  });

  describe("another comment between the annotation and the variable", () => {
    const it = test.extend("scanOfAnAnnotationSeparatedByAnotherComment", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
/** display order */
export const ORDER_STATUSES = ["draft", "published"] as const;
`));

    it("breaks direct attachment", ({ scanOfAnAnnotationSeparatedByAnotherComment }) => {
      expect(scanOfAnAnnotationSeparatedByAnotherComment).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "adjacent-declaration-required",
          },
        ],
      });
    });
  });

  describe("annotated statements that hold neither one binding nor an identifier", () => {
    const it = test.extend("scanOfStatementsWithoutASingleIdentifierBinding", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const DRAFT = "draft", PUBLISHED = "published";
/** ${CANONICAL_VALUES_TAG} article.status */
export const { status } = article;
`));

    it("must each contain one identifier binding", ({
      scanOfStatementsWithoutASingleIdentifierBinding,
    }) => {
      expect(scanOfStatementsWithoutASingleIdentifierBinding).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "single-binding-required",
          },
          {
            kind: "invalid-declaration",
            line: 3,
            conceptId: "article.status",
            reason: "identifier-binding-required",
          },
        ],
      });
    });
  });

  describe("one JSDoc carrying two canonical concepts", () => {
    const it = test.extend("scanOfOneJsdocCarryingTwoConcepts", () =>
      scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${CANONICAL_VALUES_TAG} article.status
 */
export const STATUSES = ["draft"] as const;
`));

    it("cannot declare more than one concept", ({ scanOfOneJsdocCarryingTwoConcepts }) => {
      expect(scanOfOneJsdocCarryingTwoConcepts).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "single-annotation-required",
          },
        ],
      });
    });
  });

  describe("a second tag separated from its concept by tab whitespace", () => {
    const it = test.extend("scanOfASecondTagBehindTabWhitespace", () =>
      scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${CANONICAL_VALUES_TAG}\tarticle.status
 */
export const STATUSES = ["draft"] as const;
`));

    it("cannot hide from the single-annotation check", ({
      scanOfASecondTagBehindTabWhitespace,
    }) => {
      expect(scanOfASecondTagBehindTabWhitespace).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "single-annotation-required",
          },
        ],
      });
    });
  });

  describe("an ambient variable under the annotation", () => {
    const it = test.extend("scanOfAnAmbientVariable", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export declare const ORDER_STATUSES: readonly ["draft", "published"];
`));

    it("cannot become a runtime owner", ({ scanOfAnAmbientVariable }) => {
      expect(scanOfAnAmbientVariable).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "runtime-initializer-required",
          },
        ],
      });
    });
  });

  describe("two annotated declarations on one physical line", () => {
    const it = test.extend("scanOfTwoDeclarationsOnOnePhysicalLine", () =>
      scanCanonicalValuesText(
        `/** ${CANONICAL_VALUES_TAG} order.status */ const A = ["draft"] as const; /** ${CANONICAL_VALUES_TAG} order.status */ const B = ["published"] as const;`,
      ));

    it("remain distinct occurrences", ({ scanOfTwoDeclarationsOnOnePhysicalLine }) => {
      expect(scanOfTwoDeclarationsOnOnePhysicalLine).toStrictEqual({
        declarations: [
          {
            binding: "A",
            bindingStart: 44,
            conceptId: "order.status",
            line: 1,
            annotationStart: 0,
            declarationStart: 38,
            declarationEnd: 67,
          },
          {
            binding: "B",
            bindingStart: 112,
            conceptId: "order.status",
            line: 1,
            annotationStart: 68,
            declarationStart: 106,
            declarationEnd: 139,
          },
        ],
        problems: [],
      });
    });
  });

  describe("a tag without a concept", () => {
    const it = test.extend("scanOfATagWithoutAConcept", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("is reported as a broken annotation", ({ scanOfATagWithoutAConcept }) => {
      expect(scanOfATagWithoutAConcept).toStrictEqual({
        declarations: [],
        problems: [{ kind: "unparsable-annotation", line: 1 }],
      });
    });
  });

  describe("a valid annotation with no statement after it", () => {
    const it = test.extend("scanOfAnAnnotationWithNothingAfterIt", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */`));

    it("is rejected", ({ scanOfAnAnnotationWithNothingAfterIt }) => {
      expect(scanOfAnAnnotationWithNothingAfterIt).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "variable-statement-required",
          },
        ],
      });
    });
  });

  describe("an annotated variable without a runtime initializer", () => {
    const it = test.extend("scanOfAVariableWithoutARuntimeInitializer", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
let ORDER_STATUSES;
`));

    it("is rejected", ({ scanOfAVariableWithoutARuntimeInitializer }) => {
      expect(scanOfAVariableWithoutARuntimeInitializer).toStrictEqual({
        declarations: [],
        problems: [
          {
            kind: "invalid-declaration",
            line: 1,
            conceptId: "order.status",
            reason: "runtime-initializer-required",
          },
        ],
      });
    });
  });

  describe("an unterminated annotated comment", () => {
    const it = test.extend("scanOfAnUnterminatedAnnotatedComment", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status`));

    it("is a strict parse problem", ({ scanOfAnUnterminatedAnnotatedComment }) => {
      expect(scanOfAnUnterminatedAnnotatedComment).toStrictEqual({
        declarations: [],
        problems: [{ kind: "unparsable-source", line: 1 }],
      });
    });
  });

  describe("a retired annotation tag written in the annotated comment", () => {
    const it = test.extend("scanOfARetiredTagInTheAnnotatedComment", () =>
      scanCanonicalValuesText(`/**
 * ${CANONICAL_VALUES_TAG} order.status
 * ${RETIRED_ANNOTATION_TAGS[0]}
 */
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("prevents that comment from becoming an owner", ({
      scanOfARetiredTagInTheAnnotatedComment,
    }) => {
      expect(scanOfARetiredTagInTheAnnotatedComment).toStrictEqual({
        declarations: [],
        problems: [{ kind: "retired-annotation-tag", line: 3, tag: RETIRED_ANNOTATION_TAGS[0] }],
      });
    });
  });

  describe("an oxlint directive naming a canonical rule", () => {
    const it = test.extend("scanOfAnOxlintDirectiveNamingACanonicalRule", () =>
      scanCanonicalValuesText(
        '// oxlint-disable-next-line dont-review-it/no-strict-canonical-literal-use--use-canonical-import\nconst status = "draft";\n',
      ));

    it("cannot suppress a canonical rule", ({ scanOfAnOxlintDirectiveNamingACanonicalRule }) => {
      expect(scanOfAnOxlintDirectiveNamingACanonicalRule).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("a plugin alias written with a slash", () => {
    const it = test.extend("scanOfAPluginAliasWrittenWithASlash", () =>
      scanCanonicalValuesText(
        '// oxlint-disable-next-line canonical-alias/no-strict-canonical-literal-use--use-canonical-import\nconst status = "draft";\n',
      ));

    it("cannot hide a canonical suppression", ({ scanOfAPluginAliasWrittenWithASlash }) => {
      expect(scanOfAPluginAliasWrittenWithASlash).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("a plugin alias written with parentheses", () => {
    const it = test.extend("scanOfAPluginAliasWrittenWithParentheses", () =>
      scanCanonicalValuesText(
        '// oxlint-disable-next-line canonical-alias(no-local-finite-value-set--use-or-register-canonical-values)\nconst status = "draft";\n',
      ));

    it("cannot hide a canonical suppression", ({ scanOfAPluginAliasWrittenWithParentheses }) => {
      expect(scanOfAPluginAliasWrittenWithParentheses).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("a directive that disables every rule", () => {
    const it = test.extend("scanOfADirectiveDisablingEveryRule", () =>
      scanCanonicalValuesText("/* oxlint-disable */\n"));

    it("cannot suppress canonical checks", ({ scanOfADirectiveDisablingEveryRule }) => {
      expect(scanOfADirectiveDisablingEveryRule).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("a line directive without a rule list", () => {
    const it = test.extend("scanOfALineDirectiveWithoutARuleList", () =>
      scanCanonicalValuesText("// oxlint-disable-next-line\nconst status = 'draft';\n"));

    it("cannot suppress canonical checks", ({ scanOfALineDirectiveWithoutARuleList }) => {
      expect(scanOfALineDirectiveWithoutARuleList).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an eslint-compatible directive naming a canonical rule", () => {
    const it = test.extend("scanOfAnEslintCompatibleDirective", () =>
      scanCanonicalValuesText(
        '// eslint-disable-next-line dont-review-it/no-local-finite-value-set--use-or-register-canonical-values -- forbidden escape\nconst schema = z.enum(["draft", "published"]);\n',
      ));

    it("cannot suppress a canonical rule", ({ scanOfAnEslintCompatibleDirective }) => {
      expect(scanOfAnEslintCompatibleDirective).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an eslint next-line directive carrying only a reason", () => {
    const it = test.extend("scanOfAnEslintNextLineDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText(
        "// eslint-disable-next-line -- forbidden escape\nconst status = 'draft';\n",
      ));

    it("stays a canonical suppression", ({
      scanOfAnEslintNextLineDirectiveCarryingOnlyAReason,
    }) => {
      expect(scanOfAnEslintNextLineDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an oxlint next-line directive carrying only a reason", () => {
    const it = test.extend("scanOfAnOxlintNextLineDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText(
        "// oxlint-disable-next-line -- forbidden escape\nconst status = 'draft';\n",
      ));

    it("stays a canonical suppression", ({
      scanOfAnOxlintNextLineDirectiveCarryingOnlyAReason,
    }) => {
      expect(scanOfAnOxlintNextLineDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an eslint line directive carrying only a reason", () => {
    const it = test.extend("scanOfAnEslintLineDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText(
        "const status = 'draft'; // eslint-disable-line -- forbidden escape\n",
      ));

    it("stays a canonical suppression", ({ scanOfAnEslintLineDirectiveCarryingOnlyAReason }) => {
      expect(scanOfAnEslintLineDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an oxlint line directive carrying only a reason", () => {
    const it = test.extend("scanOfAnOxlintLineDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText(
        "const status = 'draft'; // oxlint-disable-line -- forbidden escape\n",
      ));

    it("stays a canonical suppression", ({ scanOfAnOxlintLineDirectiveCarryingOnlyAReason }) => {
      expect(scanOfAnOxlintLineDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an eslint block directive carrying only a reason", () => {
    const it = test.extend("scanOfAnEslintBlockDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText("/* eslint-disable -- forbidden escape */\n"));

    it("stays a canonical suppression", ({ scanOfAnEslintBlockDirectiveCarryingOnlyAReason }) => {
      expect(scanOfAnEslintBlockDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("an oxlint block directive carrying only a reason", () => {
    const it = test.extend("scanOfAnOxlintBlockDirectiveCarryingOnlyAReason", () =>
      scanCanonicalValuesText("/* oxlint-disable -- forbidden escape */\n"));

    it("stays a canonical suppression", ({ scanOfAnOxlintBlockDirectiveCarryingOnlyAReason }) => {
      expect(scanOfAnOxlintBlockDirectiveCarryingOnlyAReason).toStrictEqual({
        declarations: [],
        problems: [{ kind: "canonical-rule-suppression", line: 1 }],
      });
    });
  });

  describe("a directive targeting an unrelated rule", () => {
    const it = test.extend("scanOfADirectiveTargetingAnUnrelatedRule", () =>
      scanCanonicalValuesText("// oxlint-disable-next-line no-console\nconsole.log(1);\n"));

    it("is not a canonical suppression", ({ scanOfADirectiveTargetingAnUnrelatedRule }) => {
      expect(scanOfADirectiveTargetingAnUnrelatedRule).toStrictEqual({
        declarations: [],
        problems: [],
      });
    });
  });

  describe("an unrelated rule name containing two hyphens", () => {
    const it = test.extend("scanOfAnUnrelatedRuleNameContainingTwoHyphens", () =>
      scanCanonicalValuesText(
        "// eslint-disable-next-line fixture/no-console--with-reason -- unrelated reason\nconsole.log(1);\n",
      ));

    it("stays unrelated", ({ scanOfAnUnrelatedRuleNameContainingTwoHyphens }) => {
      expect(scanOfAnUnrelatedRuleNameContainingTwoHyphens).toStrictEqual({
        declarations: [],
        problems: [],
      });
    });
  });

  describe("annotation spellings written inside literals", () => {
    const it = test.extend("scanOfAnnotationSpellingsInsideLiterals", () =>
      scanCanonicalValuesText(`export const TAG = "${CANONICAL_VALUES_TAG}";
export const EXAMPLE = \`/** ${CANONICAL_VALUES_TAG} doc.example */\`;
`));

    it("are not comments", ({ scanOfAnnotationSpellingsInsideLiterals }) => {
      expect(scanOfAnnotationSpellingsInsideLiterals).toStrictEqual({
        declarations: [],
        problems: [],
      });
    });
  });
});
