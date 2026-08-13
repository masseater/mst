import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

describe("scanCanonicalValuesText", () => {
  describe("a value list under the annotation", () => {
    const it = test.extend("scanOfAValueListUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`));

    it("becomes the declaration of that concept", ({ scanOfAValueListUnderTheAnnotation }) => {
      expect(scanOfAValueListUnderTheAnnotation).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("a union of literal types under the annotation", () => {
    const it = test.extend("scanOfAUnionOfLiteralTypes", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = "draft" | "published";
`));

    it("declares the same values", ({ scanOfAUnionOfLiteralTypes }) => {
      expect(scanOfAUnionOfLiteralTypes).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("an annotation written as a line comment", () => {
    const it = test.extend("scanOfAnAnnotationWrittenAsALineComment", () =>
      scanCanonicalValuesText(`// ${CANONICAL_VALUES_TAG} order.status
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("declares its concept", ({ scanOfAnAnnotationWrittenAsALineComment }) => {
      expect(scanOfAnAnnotationWrittenAsALineComment).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("a list holding a literal that is not a word, a number or a flag", () => {
    const it = test.extend("scanOfAListHoldingALiteralOutsideTheVocabulary", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", null, /published/u] as const;
`));

    it("leaves that literal out of the declared values", ({
      scanOfAListHoldingALiteralOutsideTheVocabulary,
    }) => {
      expect(scanOfAListHoldingALiteralOutsideTheVocabulary).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("a list holding a template literal that carries a substitution", () => {
    const it = test.extend("scanOfAListHoldingATemplateWithASubstitution", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", \`published-\${suffix}\`] as const;
`));

    it("leaves that template out of the declared values", ({
      scanOfAListHoldingATemplateWithASubstitution,
    }) => {
      expect(scanOfAListHoldingATemplateWithASubstitution).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("an annotation with nothing after it", () => {
    const it = test.extend("scanOfAnAnnotationWithNothingAfterIt", () =>
      scanCanonicalValuesText(`export const total = 1;
/** ${CANONICAL_VALUES_TAG} order.status */
`));

    it("declares no concept and is reported as a vocabulary without values", ({
      scanOfAnAnnotationWithNothingAfterIt,
    }) => {
      expect(scanOfAnAnnotationWithNothingAfterIt).toStrictEqual({
        declarations: [],
        problems: [{ kind: "vocabulary-without-values", line: 2, conceptId: "order.status" }],
      });
    });
  });

  describe("a list holding a template literal without a substitution", () => {
    const it = test.extend("scanOfAListHoldingATemplateWithoutASubstitution", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = [\`draft\`, "published"] as const;
`));

    it("keeps that template among the declared values", ({
      scanOfAListHoldingATemplateWithoutASubstitution,
    }) => {
      expect(scanOfAListHoldingATemplateWithoutASubstitution).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("numbers under the annotation", () => {
    const it = test.extend("scanOfNumbersUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} retry.attempt */
export const RETRY_ATTEMPTS = [1, 2, 3] as const;
`));

    it("are declared values", ({ scanOfNumbersUnderTheAnnotation }) => {
      expect(scanOfNumbersUnderTheAnnotation).toStrictEqual({
        declarations: [{ conceptId: "retry.attempt", values: [1, 2, 3], line: 1 }],
        problems: [],
      });
    });
  });

  describe("booleans under the annotation", () => {
    const it = test.extend("scanOfBooleansUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} toggle.state */
export const TOGGLE_STATES = [true, false] as const;
`));

    it("are declared values", ({ scanOfBooleansUnderTheAnnotation }) => {
      expect(scanOfBooleansUnderTheAnnotation).toStrictEqual({
        declarations: [{ conceptId: "toggle.state", values: [true, false], line: 1 }],
        problems: [],
      });
    });
  });

  describe("an enum body under the annotation", () => {
    const it = test.extend("scanOfAnEnumBodyUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export enum OrderStatus {
  Draft = "draft",
  Published = "published",
}

export const UNRELATED = ["not-a-status"] as const;
`));

    it("declares its member values", ({ scanOfAnEnumBodyUnderTheAnnotation }) => {
      expect(scanOfAnEnumBodyUnderTheAnnotation).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("quoted property keys under the annotation", () => {
    const it = test.extend("scanOfQuotedPropertyKeysUnderTheAnnotation", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUS = { "Draft": "draft", "Published": "published" } as const;
`));

    it("are left out of the declared values", ({ scanOfQuotedPropertyKeysUnderTheAnnotation }) => {
      expect(scanOfQuotedPropertyKeysUnderTheAnnotation).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
        problems: [],
      });
    });
  });

  describe("a type annotation on the declaration", () => {
    const it = test.extend("scanOfATypeAnnotatedDeclaration", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES: readonly string[] = ["draft", "published"];
`));

    it("does not cut the value list short", ({ scanOfATypeAnnotatedDeclaration }) => {
      expect(scanOfATypeAnnotatedDeclaration).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
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

  describe("a retired annotation tag left in a comment", () => {
    const it = test.extend("scanOfARetiredTagLeftInAComment", () =>
      scanCanonicalValuesText(`export const A = 1;
/** ${RETIRED_ANNOTATION_TAGS[0]} */
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("is rejected by name", ({ scanOfARetiredTagLeftInAComment }) => {
      expect(scanOfARetiredTagLeftInAComment).toStrictEqual({
        declarations: [],
        problems: [{ kind: "retired-annotation-tag", line: 2, tag: RETIRED_ANNOTATION_TAGS[0] }],
      });
    });
  });

  describe("annotation tags written as string literals", () => {
    const it = test.extend("scanOfTagsWrittenAsStringLiterals", () =>
      scanCanonicalValuesText(`export const TAG = "${CANONICAL_VALUES_TAG}";
export const RETIRED = ${JSON.stringify(RETIRED_ANNOTATION_TAGS)};
`));

    it("declare nothing and break nothing", ({ scanOfTagsWrittenAsStringLiterals }) => {
      expect(scanOfTagsWrittenAsStringLiterals).toStrictEqual({ declarations: [], problems: [] });
    });
  });

  describe("a regular expression holding a quote", () => {
    const it = test.extend("scanOfARegularExpressionHoldingAQuote", () =>
      scanCanonicalValuesText(`const QUOTES = /['"]/u;
/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`));

    it("does not hide the annotation behind it", ({ scanOfARegularExpressionHoldingAQuote }) => {
      expect(scanOfARegularExpressionHoldingAQuote).toStrictEqual({
        declarations: [{ conceptId: "order.status", values: ["draft"], line: 2 }],
        problems: [],
      });
    });
  });

  describe("an annotation on a declaration that spells out no value", () => {
    const it = test.extend("scanOfADeclarationThatSpellsOutNoValue", () =>
      scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = string;
`));

    it("is rejected", ({ scanOfADeclarationThatSpellsOutNoValue }) => {
      expect(scanOfADeclarationThatSpellsOutNoValue).toStrictEqual({
        declarations: [],
        problems: [{ kind: "vocabulary-without-values", line: 1, conceptId: "order.status" }],
      });
    });
  });
});
