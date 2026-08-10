import { expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const declaredValuesIn = (sourceText: string): readonly (readonly unknown[])[] =>
  scanCanonicalValuesText(sourceText).declarations.map((declaration) => declaration.values);

test("a value list under the annotation becomes the declaration of that concept", () => {
  const scanned = scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`);

  expect(scanned).toStrictEqual({
    problems: [],
    declarations: [{ conceptId: "order.status", values: ["draft", "published"], line: 1 }],
  });
});

test("a union of literal types under the annotation declares the same values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = "draft" | "published";
`),
  ).toStrictEqual([["draft", "published"]]);
});

test("an annotation written as a line comment declares its concept", () => {
  const scanned = scanCanonicalValuesText(`// ${CANONICAL_VALUES_TAG} order.status
export const ORDER_STATUSES = ["draft"] as const;
`);

  expect(scanned.declarations.map((declaration) => declaration.conceptId)).toStrictEqual([
    "order.status",
  ]);
});

test("a literal that is not a word, a number or a flag is not one of the declared values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", null, /published/u] as const;
`),
  ).toStrictEqual([["draft"]]);
});

test("an annotation with nothing after it declares no concept", () => {
  const scanned = scanCanonicalValuesText(`export const total = 1;
/** ${CANONICAL_VALUES_TAG} order.status */
`);

  expect(scanned.declarations).toStrictEqual([]);
  expect(scanned.problems).toStrictEqual([
    { kind: "vocabulary-without-values", line: 2, conceptId: "order.status" },
  ]);
});

test("a template literal without a substitution is one of the declared values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = [\`draft\`, "published"] as const;
`),
  ).toStrictEqual([["draft", "published"]]);
});

test("numbers and booleans under the annotation are declared values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} retry.attempt */
export const RETRY_ATTEMPTS = [1, 2, 3] as const;
`),
  ).toStrictEqual([[1, 2, 3]]);
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} toggle.state */
export const TOGGLE_STATES = [true, false] as const;
`),
  ).toStrictEqual([[true, false]]);
});

test("an enum body under the annotation declares its member values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export enum OrderStatus {
  Draft = "draft",
  Published = "published",
}

export const UNRELATED = ["not-a-status"] as const;
`),
  ).toStrictEqual([["draft", "published"]]);
});

test("a quoted property key is not one of the declared values", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUS = { "Draft": "draft", "Published": "published" } as const;
`),
  ).toStrictEqual([["draft", "published"]]);
});

test("a type annotation on the declaration does not cut the value list short", () => {
  expect(
    declaredValuesIn(`/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES: readonly string[] = ["draft", "published"];
`),
  ).toStrictEqual([["draft", "published"]]);
});

test("a tag without a concept is reported as a broken annotation", () => {
  expect(
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`),
  ).toStrictEqual({
    declarations: [],
    problems: [{ kind: "unparsable-annotation", line: 1 }],
  });
});

test("a retired annotation tag left in a comment is rejected by name", () => {
  const retired = RETIRED_ANNOTATION_TAGS[0];

  expect(
    scanCanonicalValuesText(`export const A = 1;
/** ${retired} */
export const ORDER_STATUSES = ["draft"] as const;
`),
  ).toStrictEqual({
    declarations: [],
    problems: [{ kind: "retired-annotation-tag", line: 2, tag: retired }],
  });
});

test("annotation tags written as string literals declare nothing and break nothing", () => {
  expect(
    scanCanonicalValuesText(`export const TAG = "${CANONICAL_VALUES_TAG}";
export const RETIRED = ${JSON.stringify(RETIRED_ANNOTATION_TAGS)};
`),
  ).toStrictEqual({ declarations: [], problems: [] });
});

test("a regular expression holding a quote does not hide the annotation behind it", () => {
  const scanned = scanCanonicalValuesText(`const QUOTES = /['"]/u;
/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`);

  expect(scanned.declarations.map((declaration) => declaration.conceptId)).toStrictEqual([
    "order.status",
  ]);
});

test("an annotation on a declaration that spells out no value is rejected", () => {
  expect(
    scanCanonicalValuesText(`/** ${CANONICAL_VALUES_TAG} order.status */
export type OrderStatus = string;
`),
  ).toStrictEqual({
    declarations: [],
    problems: [{ kind: "vocabulary-without-values", line: 1, conceptId: "order.status" }],
  });
});
