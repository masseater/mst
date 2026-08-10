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

type ParsedSource = {
  readonly program: ESTree.Program;
  readonly sourceText: string;
};

const annotatedDeclarationRange = (
  { program, sourceText }: ParsedSource,
  comment: Comment,
): AnnotatedDeclarationRange | null => {
  if (!isJsDocComment(comment)) return null;

  const annotation = parseCanonicalValuesAnnotation(comment.value);
  if (annotation === null) return null;

  const nested = program.body.some(
    (statement) => statement.start <= comment.start && comment.end <= statement.end,
  );
  if (nested) return null;

  const owner = program.body.find((statement) => statement.start >= comment.end);
  if (owner === undefined) return null;
  if (sourceText.slice(comment.end, owner.start).trim() !== "") return null;

  return { conceptId: annotation.conceptId, start: owner.start, end: owner.end };
};

export const annotatedDeclarationRanges = (
  program: ESTree.Program,
  sourceText: string,
): readonly AnnotatedDeclarationRange[] => {
  const source: ParsedSource = { program, sourceText };
  return program.comments
    .map((comment) => annotatedDeclarationRange(source, comment))
    .filter((range) => range !== null);
};

export const isInsideAnnotatedDeclaration = (
  ranges: readonly AnnotatedDeclarationRange[],
  node: ESTree.Span,
): boolean => ranges.some((range) => node.start >= range.start && node.end <= range.end);
