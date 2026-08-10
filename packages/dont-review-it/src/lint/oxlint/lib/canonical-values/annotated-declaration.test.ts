import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
} from "./annotated-declaration.ts";

const rangesIn = (sourceText: string) => {
  const parsed = parseSync("source.ts", sourceText);
  return annotatedDeclarationRanges(
    { body: parsed.program.body, comments: parsed.comments },
    sourceText,
  );
};

const conceptIdsIn = (sourceText: string): readonly string[] =>
  rangesIn(sourceText).map((range) => range.conceptId);

describe("annotatedDeclarationRanges", () => {
  test("an annotation sitting on a declaration marks that declaration", () => {
    expect(
      conceptIdsIn(`/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual(["order.status"]);
  });

  test("a doc comment that declares no concept marks nothing", () => {
    expect(
      conceptIdsIn(`/** what the order went through */
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("a line comment carrying the tag marks nothing, because only a doc comment does", () => {
    expect(
      conceptIdsIn(`// @canonical-values order.status
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("an annotation with no declaration after it marks nothing", () => {
    expect(
      conceptIdsIn(`export const ORDER_STATUSES = ["draft"] as const;
/** @canonical-values order.status */
`),
    ).toStrictEqual([]);
  });

  test("an annotation with something other than the declaration after it marks nothing", () => {
    expect(
      conceptIdsIn(`/** @canonical-values order.status */
// what the order went through
export const ORDER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("an annotation nested inside a declaration marks nothing", () => {
    expect(
      conceptIdsIn(`export const ORDER = {
  /** @canonical-values order.status */
  statuses: ["draft"],
};
`),
    ).toStrictEqual([]);
  });
});

describe("isInsideAnnotatedDeclaration", () => {
  test("a node inside a marked declaration is inside it", () => {
    const ranges = rangesIn(`/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft"] as const;
`);

    expect(isInsideAnnotatedDeclaration(ranges, { start: 40, end: 45 })).toBe(true);
  });

  test("a node outside every marked declaration is outside them", () => {
    const ranges = rangesIn(`/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft"] as const;
`);

    expect(isInsideAnnotatedDeclaration(ranges, { start: 0, end: 5 })).toBe(false);
  });
});
