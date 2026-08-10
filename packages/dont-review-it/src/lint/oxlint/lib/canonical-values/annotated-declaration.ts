import { parseCanonicalValuesAnnotation } from "./annotation.ts";

export type AnnotatedDeclarationRange = {
  readonly conceptId: string;
  readonly start: number;
  readonly end: number;
};

type SourceSpan = {
  readonly start: number;
  readonly end: number;
};

type SourceComment = SourceSpan & {
  readonly type: string;
  readonly value: string;
};

type AnnotatedProgram = {
  readonly body: readonly SourceSpan[];
  readonly comments: readonly SourceComment[];
};

type ParsedSource = {
  readonly program: AnnotatedProgram;
  readonly sourceText: string;
};

const JSDOC_COMMENT_VALUE_PREFIX = "*";

const isJsDocComment = (comment: SourceComment): boolean =>
  comment.type === "Block" && comment.value.startsWith(JSDOC_COMMENT_VALUE_PREFIX);

const annotatedDeclarationRange = (
  { program, sourceText }: ParsedSource,
  comment: SourceComment,
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
  program: AnnotatedProgram,
  sourceText: string,
): readonly AnnotatedDeclarationRange[] => {
  const source: ParsedSource = { program, sourceText };
  return program.comments
    .map((comment) => annotatedDeclarationRange(source, comment))
    .filter((range) => range !== null);
};

export const isInsideAnnotatedDeclaration = (
  ranges: readonly AnnotatedDeclarationRange[],
  node: SourceSpan,
): boolean => ranges.some((range) => node.start >= range.start && node.end <= range.end);
