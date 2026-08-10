import { parseCanonicalValuesAnnotation } from "./annotation.ts";

import type { Comment, ESTree } from "@oxlint/plugins";

export type AnnotatedDeclarationRange = {
  readonly conceptId: string;
  readonly start: number;
  readonly end: number;
};

const JSDOC_COMMENT_VALUE_PREFIX = "*";

const isJsDocComment = (comment: Comment): boolean =>
  comment.type === "Block" && comment.value.startsWith(JSDOC_COMMENT_VALUE_PREFIX);

export const annotatedDeclarationRanges = (
  program: ESTree.Program,
  sourceText: string,
): readonly AnnotatedDeclarationRange[] => {
  const ranges: AnnotatedDeclarationRange[] = [];
  for (const comment of program.comments) {
    if (!isJsDocComment(comment)) continue;
    const annotation = parseCanonicalValuesAnnotation(comment.value);
    if (annotation === null) continue;
    const nested = program.body.some(
      (statement) => statement.start <= comment.start && comment.end <= statement.end,
    );
    if (nested) continue;
    const owner = program.body.find((statement) => statement.start >= comment.end);
    if (owner === undefined) continue;
    if (sourceText.slice(comment.end, owner.start).trim() !== "") continue;
    ranges.push({ conceptId: annotation.conceptId, start: owner.start, end: owner.end });
  }
  return ranges;
};

export const isInsideAnnotatedDeclaration = (
  ranges: readonly AnnotatedDeclarationRange[],
  node: ESTree.Span,
): boolean => ranges.some((range) => node.start >= range.start && node.end <= range.end);
