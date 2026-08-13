import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
} from "./annotated-declaration.ts";

describe("annotatedDeclarationRanges", () => {
  describe("an annotation sitting on a declaration", () => {
    const it = test.extend("rangesOfAnnotationOnADeclaration", () => {
      const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks that declaration", ({ rangesOfAnnotationOnADeclaration }) => {
      expect(rangesOfAnnotationOnADeclaration).toStrictEqual([
        { conceptId: "user.status", start: 37, end: 85 },
      ]);
    });
  });

  describe("a doc comment that declares no concept", () => {
    const it = test.extend("rangesOfDocCommentWithoutAConcept", () => {
      const sourceText = `/** what the value stands for */
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks nothing", ({ rangesOfDocCommentWithoutAConcept }) => {
      expect(rangesOfDocCommentWithoutAConcept).toStrictEqual([]);
    });
  });

  describe("a line comment carrying the tag", () => {
    const it = test.extend("rangesOfLineCommentCarryingTheTag", () => {
      const sourceText = `// @canonical-values user.status
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks nothing, because only a doc comment does", ({
      rangesOfLineCommentCarryingTheTag,
    }) => {
      expect(rangesOfLineCommentCarryingTheTag).toStrictEqual([]);
    });
  });

  describe("an annotation with no declaration after it", () => {
    const it = test.extend("rangesOfAnnotationWithNothingAfterIt", () => {
      const sourceText = `export const USER_STATUSES = ["draft"] as const;
/** @canonical-values user.status */
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks nothing", ({ rangesOfAnnotationWithNothingAfterIt }) => {
      expect(rangesOfAnnotationWithNothingAfterIt).toStrictEqual([]);
    });
  });

  describe("an annotation with something other than the declaration after it", () => {
    const it = test.extend("rangesOfAnnotationFollowedByAnotherComment", () => {
      const sourceText = `/** @canonical-values user.status */
// what the value stands for
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks nothing", ({ rangesOfAnnotationFollowedByAnotherComment }) => {
      expect(rangesOfAnnotationFollowedByAnotherComment).toStrictEqual([]);
    });
  });

  describe("an annotation nested inside a declaration", () => {
    const it = test.extend("rangesOfAnnotationNestedInADeclaration", () => {
      const sourceText = `export const ORDER = {
  /** @canonical-values user.status */
  statuses: ["draft"],
};
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      return annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
    });

    it("marks nothing", ({ rangesOfAnnotationNestedInADeclaration }) => {
      expect(rangesOfAnnotationNestedInADeclaration).toStrictEqual([]);
    });
  });
});

describe("isInsideAnnotatedDeclaration", () => {
  describe("a node inside a marked declaration", () => {
    const it = test.extend("insideVerdictForANodeWithinTheMarkedDeclaration", () => {
      const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      const ranges = annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
      return isInsideAnnotatedDeclaration(ranges, { start: 40, end: 45 });
    });

    it("is inside it", ({ insideVerdictForANodeWithinTheMarkedDeclaration }) => {
      expect(insideVerdictForANodeWithinTheMarkedDeclaration).toBe(true);
    });
  });

  describe("a node outside every marked declaration", () => {
    const it = test.extend("insideVerdictForANodeOutsideEveryMarkedDeclaration", () => {
      const sourceText = `/** @canonical-values user.status */
export const USER_STATUSES = ["draft"] as const;
`;
      const parsedSourceFile = parseSync("source.ts", sourceText);
      const ranges = annotatedDeclarationRanges(
        {
          body: parsedSourceFile.program.body,
          comments: parsedSourceFile.comments,
        },
        sourceText,
      );
      return isInsideAnnotatedDeclaration(ranges, { start: 0, end: 5 });
    });

    it("is outside them", ({ insideVerdictForANodeOutsideEveryMarkedDeclaration }) => {
      expect(insideVerdictForANodeOutsideEveryMarkedDeclaration).toBe(false);
    });
  });
});
