import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
} from "./annotated-declaration.ts";

const rangesIn = (sourceText: string) => {
  const parsedNode = parseSync("source.ts", sourceText);
  return annotatedDeclarationRanges(
    { body: parsedNode.program.body, comments: parsedNode.comments },
    sourceText,
  );
};

const conceptIdsIn = (sourceText: string): readonly string[] =>
  rangesIn(sourceText).map((range) => range.conceptId);

describe("annotatedDeclarationRanges", () => {
  test("an annotation sitting on a declaration marks that declaration", () => {
    expect(
      conceptIdsIn(`/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual(["user.status"]);
  });

  test("a doc comment that declares no concept marks nothing", () => {
    expect(
      conceptIdsIn(`/** what the value stands for */
export const USER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("a line comment carrying the tag marks nothing, because only a doc comment does", () => {
    expect(
      conceptIdsIn(`// @canonical-values user.status
export const USER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("an annotation with no declaration after it marks nothing", () => {
    expect(
      conceptIdsIn(`export const USER_STATUSES = ["draft"] as const;
/** @canonical-values user.status */
`),
    ).toStrictEqual([]);
  });

  test("an annotation with something other than the declaration after it marks nothing", () => {
    expect(
      conceptIdsIn(`/** @canonical-values user.status */
// what the value stands for
export const USER_STATUSES = ["draft"] as const;
`),
    ).toStrictEqual([]);
  });

  test("an annotation nested inside a declaration marks nothing", () => {
    expect(
      conceptIdsIn(`export const ORDER = {
  /** @canonical-values user.status */
  statuses: ["draft"],
};
`),
    ).toStrictEqual([]);
  });
});

describe("isInsideAnnotatedDeclaration", () => {
  test("a node inside a marked declaration is inside it", () => {
    const ranges = rangesIn(`/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`);

    expect(isInsideAnnotatedDeclaration(ranges, { start: 40, end: 45 })).toBe(true);
  });

  test("a node outside every marked declaration is outside them", () => {
    const ranges = rangesIn(`/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`);

    expect(isInsideAnnotatedDeclaration(ranges, { start: 0, end: 5 })).toBe(false);
  });
});
