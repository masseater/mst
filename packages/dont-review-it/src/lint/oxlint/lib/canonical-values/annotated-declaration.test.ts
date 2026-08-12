import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
} from "./annotated-declaration.ts";

const it = test
  .extend("rangesOfAnnotationOnADeclaration", () => {
    const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("rangesOfDocCommentWithoutAConcept", () => {
    const sourceText = `/** what the value stands for */
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("rangesOfLineCommentCarryingTheTag", () => {
    const sourceText = `// @canonical-values user.status
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("rangesOfAnnotationWithNothingAfterIt", () => {
    const sourceText = `export const USER_STATUSES = ["draft"] as const;
/** @canonical-values user.status */
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("rangesOfAnnotationFollowedByAnotherComment", () => {
    const sourceText = `/** @canonical-values user.status */
// what the value stands for
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("rangesOfAnnotationNestedInADeclaration", () => {
    const sourceText = `export const ORDER = {
  /** @canonical-values user.status */
  statuses: ["draft"],
};
`;
    const parsed = parseSync("source.ts", sourceText);
    return annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
  })
  .extend("insideVerdictForANodeWithinTheMarkedDeclaration", () => {
    const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    const ranges = annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
    return isInsideAnnotatedDeclaration(ranges, { start: 40, end: 45 });
  })
  .extend("insideVerdictForANodeOutsideEveryMarkedDeclaration", () => {
    const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
    const parsed = parseSync("source.ts", sourceText);
    const ranges = annotatedDeclarationRanges(
      { body: parsed.program.body, comments: parsed.comments },
      sourceText,
    );
    return isInsideAnnotatedDeclaration(ranges, { start: 0, end: 5 });
  });

describe("annotatedDeclarationRanges", () => {
  it("an annotation sitting on a declaration marks that declaration", ({
    rangesOfAnnotationOnADeclaration,
  }) => {
    expect(rangesOfAnnotationOnADeclaration).toStrictEqual([
      { conceptId: "user.status", start: 37, end: 85 },
    ]);
  });

  it("a doc comment that declares no concept marks nothing", ({
    rangesOfDocCommentWithoutAConcept,
  }) => {
    expect(rangesOfDocCommentWithoutAConcept).toStrictEqual([]);
  });

  it("a line comment carrying the tag marks nothing, because only a doc comment does", ({
    rangesOfLineCommentCarryingTheTag,
  }) => {
    expect(rangesOfLineCommentCarryingTheTag).toStrictEqual([]);
  });

  it("an annotation with no declaration after it marks nothing", ({
    rangesOfAnnotationWithNothingAfterIt,
  }) => {
    expect(rangesOfAnnotationWithNothingAfterIt).toStrictEqual([]);
  });

  it("an annotation with something other than the declaration after it marks nothing", ({
    rangesOfAnnotationFollowedByAnotherComment,
  }) => {
    expect(rangesOfAnnotationFollowedByAnotherComment).toStrictEqual([]);
  });

  it("an annotation nested inside a declaration marks nothing", ({
    rangesOfAnnotationNestedInADeclaration,
  }) => {
    expect(rangesOfAnnotationNestedInADeclaration).toStrictEqual([]);
  });
});

describe("isInsideAnnotatedDeclaration", () => {
  it("a node inside a marked declaration is inside it", ({
    insideVerdictForANodeWithinTheMarkedDeclaration,
  }) => {
    expect(insideVerdictForANodeWithinTheMarkedDeclaration).toBe(true);
  });

  it("a node outside every marked declaration is outside them", ({
    insideVerdictForANodeOutsideEveryMarkedDeclaration,
  }) => {
    expect(insideVerdictForANodeOutsideEveryMarkedDeclaration).toBe(false);
  });
});
