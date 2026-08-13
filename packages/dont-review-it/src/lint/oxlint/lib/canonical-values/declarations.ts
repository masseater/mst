import { uniq } from "es-toolkit";
import { parseSync, type Comment, type ParseResult } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD } from "../ast-node.ts";
import {
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
  type CanonicalValuesAnnotation,
} from "./annotation.ts";

import type { CanonicalValue } from "./fingerprint.ts";

export type CanonicalValuesDeclaration = {
  readonly conceptId: string;
  readonly values: readonly CanonicalValue[];
  readonly line: number;
};

export type CanonicalValuesTextProblem =
  | { readonly kind: "retired-annotation-tag"; readonly line: number; readonly tag: string }
  | { readonly kind: "unparsable-annotation"; readonly line: number }
  | {
      readonly kind: "vocabulary-without-values";
      readonly line: number;
      readonly conceptId: string;
    };

export type CanonicalValuesTextScan = {
  readonly declarations: readonly CanonicalValuesDeclaration[];
  readonly problems: readonly CanonicalValuesTextProblem[];
};

const COMMENT_BODY_OFFSET = "//".length;

const DEFAULT_SOURCE_NAME = "source.ts";

const KEY_FIELD_BY_NODE_TYPE: ReadonlyMap<string, string> = new Map([
  ["MethodDefinition", "key"],
  ["Property", "key"],
  ["PropertyDefinition", "key"],
  ["TSEnumMember", "id"],
  ["TSMethodSignature", "key"],
  ["TSPropertySignature", "key"],
]);

const lineAt = (writtenText: string, offset: number): number =>
  writtenText.slice(0, offset).split("\n").length;

const withoutRetiredTags = (commentValue: string): string =>
  RETIRED_ANNOTATION_TAGS.reduce((remaining, tag) => remaining.replaceAll(tag, ""), commentValue);

const scalarLiteralValueOf = (node: Readonly<Record<string, unknown>>): CanonicalValue | null => {
  const { value } = node;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return null;
};

const templateLiteralValueOf = (node: Readonly<Record<string, unknown>>): CanonicalValue | null => {
  const { expressions, quasis } = node as {
    readonly expressions: readonly unknown[];
    readonly quasis: readonly { readonly value: { readonly cooked: string } }[];
  };
  return expressions.length === 0
    ? quasis
        .slice(0, 1)
        .map((quasi) => quasi.value.cooked)
        .join("")
    : null;
};

const literalValueOf = (node: Readonly<Record<string, unknown>>): CanonicalValue | null => {
  if (node[NODE_TYPE_FIELD] === "Literal") return scalarLiteralValueOf(node);
  if (node[NODE_TYPE_FIELD] !== "TemplateLiteral") return null;
  return templateLiteralValueOf(node);
};

const spelledOutValuesIn = (node: unknown): readonly CanonicalValue[] => {
  if (Array.isArray(node)) return node.flatMap(spelledOutValuesIn);
  if (!isAstFields(node)) return [];
  if (typeof node[NODE_TYPE_FIELD] !== "string") return [];

  const literal = literalValueOf(node);
  if (literal !== null) return [literal];

  const keyField = KEY_FIELD_BY_NODE_TYPE.get(node[NODE_TYPE_FIELD]);
  return Object.entries(node)
    .filter(([field]) => field !== NODE_TYPE_FIELD && field !== keyField)
    .flatMap(([, held]) => spelledOutValuesIn(held));
};

const declarationAfter = (program: ParseResult["program"], comment: Comment): unknown =>
  program.body.find((statement) => statement.start >= comment.end) ?? null;

const scanAnnotatedComment = ({
  program,
  comment,
  annotation,
  line,
}: {
  readonly program: ParseResult["program"];
  readonly comment: Comment;
  readonly annotation: CanonicalValuesAnnotation;
  readonly line: number;
}): CanonicalValuesTextScan => {
  const vocabulary = uniq(spelledOutValuesIn(declarationAfter(program, comment)));
  if (vocabulary.length === 0) {
    return {
      declarations: [],
      problems: [{ kind: "vocabulary-without-values", line, conceptId: annotation.conceptId }],
    };
  }

  return {
    declarations: [{ conceptId: annotation.conceptId, values: vocabulary, line }],
    problems: [],
  };
};

type ParsedSource = {
  readonly sourceText: string;
  readonly program: ParseResult["program"];
};

const scanComment = (
  { sourceText, program }: ParsedSource,
  comment: Comment,
): CanonicalValuesTextScan => {
  const bodyOffset = comment.start + COMMENT_BODY_OFFSET;
  const problems: readonly CanonicalValuesTextProblem[] = findRetiredAnnotationTags(
    comment.value,
  ).map((tag) => ({
    kind: "retired-annotation-tag",
    line: lineAt(sourceText, bodyOffset + comment.value.indexOf(tag)),
    tag,
  }));

  if (!containsCanonicalValuesAnnotation(withoutRetiredTags(comment.value))) {
    return { declarations: [], problems };
  }

  const line = lineAt(sourceText, bodyOffset);
  const annotation = parseCanonicalValuesAnnotation(comment.value);
  if (annotation === null) {
    return { declarations: [], problems: [...problems, { kind: "unparsable-annotation", line }] };
  }

  const scan = scanAnnotatedComment({ program, comment, annotation, line });
  return { declarations: scan.declarations, problems: [...problems, ...scan.problems] };
};

export const scanCanonicalValuesText = (
  sourceText: string,
  sourceName: string = DEFAULT_SOURCE_NAME,
): CanonicalValuesTextScan => {
  const parsedNode = parseSync(sourceName, sourceText);
  const source: ParsedSource = { sourceText, program: parsedNode.program };
  const scans = parsedNode.comments.map((comment) => scanComment(source, comment));

  return {
    declarations: scans.flatMap((scan) => scan.declarations),
    problems: scans.flatMap((scan) => scan.problems),
  };
};
