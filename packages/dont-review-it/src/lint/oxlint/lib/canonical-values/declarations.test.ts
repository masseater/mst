import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const it = test
  .extend("scanOfAValueListUnderTheAnnotation", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`))
  .extend("scanOfAUnionOfLiteralTypes", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = "draft" | "published";
`),
  )
  .extend("scanOfAnAnnotationWrittenAsALineComment", () =>
    scanCanonicalValuesText(`// ${CANONICAL_VALUES_TAG} order.status
export const ORDER_STATUSES = ["draft"] as const;
`),
  )
  .extend("scanOfAListHoldingALiteralOutsideTheVocabulary", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", null, /published/u] as const;
`),
  )
  .extend("scanOfAListHoldingATemplateWithASubstitution", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", \`published-\${suffix}\`] as const;
`),
  )
  .extend("scanOfAnAnnotationWithNothingAfterIt", () =>
    scanCanonicalValuesText(`export const total = 1;
/** ${CANONICAL_VALUES_TAG} order.status */
`),
  )
  .extend("scanOfAListHoldingATemplateWithoutASubstitution", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = [\`draft\`, "published"] as const;
`),
  )
  .extend("scanOfNumbersUnderTheAnnotation", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} retry.attempt */
export const RETRY_ATTEMPTS = [1, 2, 3] as const;
`),
  )
  .extend("scanOfBooleansUnderTheAnnotation", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} toggle.state */
export const TOGGLE_STATES = [true, false] as const;
`),
  )
  .extend("scanOfAnEnumBodyUnderTheAnnotation", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export enum OrderStatus {
  Draft = "draft",
  Published = "published",
}

export const UNRELATED = ["not-a-status"] as const;
`),
  )
  .extend("scanOfQuotedPropertyKeysUnderTheAnnotation", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUS = { "Draft": "draft", "Published": "published" } as const;
`),
  )
  .extend("scanOfATypeAnnotatedDeclaration", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES: readonly string[] = ["draft", "published"];
`),
  )
  .extend("scanOfATagWithoutAConcept", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`),
  )
  .extend("scanOfARetiredTagLeftInAComment", () =>
    scanCanonicalValuesText(`export const A = 1;
/** ${RETIRED_ANNOTATION_TAGS[0]} */
export const ORDER_STATUSES = ["draft"] as const;
`),
  )
  .extend("scanOfTagsWrittenAsStringLiterals", () =>
    scanCanonicalValuesText(`export const TAG = "${CANONICAL_VALUES_TAG}";
export const RETIRED = ${JSON.stringify(RETIRED_ANNOTATION_TAGS)};
`),
  )
  .extend("scanOfARegularExpressionHoldingAQuote", () =>
    scanCanonicalValuesText(`const QUOTES = /['"]/u;
/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`),
  )
  .extend("scanOfADeclarationThatSpellsOutNoValue", () =>
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = string;
`),
  );

describe("declarations", () => {
  it("a value list under the annotation becomes the declaration of that concept", ({
    scanOfAValueListUnderTheAnnotation,
  }) => {
    expect(scanOfAValueListUnderTheAnnotation).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("a union of literal types under the annotation declares the same values", ({
    scanOfAUnionOfLiteralTypes,
  }) => {
    expect(scanOfAUnionOfLiteralTypes).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("an annotation written as a line comment declares its concept", ({
    scanOfAnAnnotationWrittenAsALineComment,
  }) => {
    expect(scanOfAnAnnotationWrittenAsALineComment).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
      problems: [],
    });
  });

  it("a literal that is not a word, a number or a flag is not one of the declared values", ({
    scanOfAListHoldingALiteralOutsideTheVocabulary,
  }) => {
    expect(scanOfAListHoldingALiteralOutsideTheVocabulary).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
      problems: [],
    });
  });

  it("a template literal carrying a substitution is not one of the declared values", ({
    scanOfAListHoldingATemplateWithASubstitution,
  }) => {
    expect(scanOfAListHoldingATemplateWithASubstitution).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft"], line: 1 }],
      problems: [],
    });
  });

  it("an annotation with nothing after it declares no concept", ({
    scanOfAnAnnotationWithNothingAfterIt,
  }) => {
    expect(scanOfAnAnnotationWithNothingAfterIt).toStrictEqual({
      declarations: [],
      problems: [{ kind: "vocabulary-without-values", line: 2, conceptId: "order.status" }],
    });
  });

  it("a template literal without a substitution is one of the declared values", ({
    scanOfAListHoldingATemplateWithoutASubstitution,
  }) => {
    expect(scanOfAListHoldingATemplateWithoutASubstitution).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("numbers under the annotation are declared values", ({ scanOfNumbersUnderTheAnnotation }) => {
    expect(scanOfNumbersUnderTheAnnotation).toStrictEqual({
      declarations: [{ conceptId: "retry.attempt", values: [1, 2, 3], line: 1 }],
      problems: [],
    });
  });

  it("booleans under the annotation are declared values", ({
    scanOfBooleansUnderTheAnnotation,
  }) => {
    expect(scanOfBooleansUnderTheAnnotation).toStrictEqual({
      declarations: [{ conceptId: "toggle.state", values: [true, false], line: 1 }],
      problems: [],
    });
  });

  it("an enum body under the annotation declares its member values", ({
    scanOfAnEnumBodyUnderTheAnnotation,
  }) => {
    expect(scanOfAnEnumBodyUnderTheAnnotation).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("a quoted property key is not one of the declared values", ({
    scanOfQuotedPropertyKeysUnderTheAnnotation,
  }) => {
    expect(scanOfQuotedPropertyKeysUnderTheAnnotation).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("a type annotation on the declaration does not cut the value list short", ({
    scanOfATypeAnnotatedDeclaration,
  }) => {
    expect(scanOfATypeAnnotatedDeclaration).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
      problems: [],
    });
  });

  it("a tag without a concept is reported as a broken annotation", ({
    scanOfATagWithoutAConcept,
  }) => {
    expect(scanOfATagWithoutAConcept).toStrictEqual({
      declarations: [],
      problems: [{ kind: "unparsable-annotation", line: 1 }],
    });
  });

  it("a retired annotation tag left in a comment is rejected by name", ({
    scanOfARetiredTagLeftInAComment,
  }) => {
    expect(scanOfARetiredTagLeftInAComment).toStrictEqual({
      declarations: [],
      problems: [{ kind: "retired-annotation-tag", line: 2, tag: RETIRED_ANNOTATION_TAGS[0] }],
    });
  });

  it("annotation tags written as string literals declare nothing and break nothing", ({
    scanOfTagsWrittenAsStringLiterals,
  }) => {
    expect(scanOfTagsWrittenAsStringLiterals).toStrictEqual({ declarations: [], problems: [] });
  });

  it("a regular expression holding a quote does not hide the annotation behind it", ({
    scanOfARegularExpressionHoldingAQuote,
  }) => {
    expect(scanOfARegularExpressionHoldingAQuote).toStrictEqual({
      declarations: [{ conceptId: "order.status", values: ["draft"], line: 2 }],
      problems: [],
    });
  });

  it("an annotation on a declaration that spells out no value is rejected", ({
    scanOfADeclarationThatSpellsOutNoValue,
  }) => {
    expect(scanOfADeclarationThatSpellsOutNoValue).toStrictEqual({
      declarations: [],
      problems: [{ kind: "vocabulary-without-values", line: 1, conceptId: "order.status" }],
    });
  });
});
