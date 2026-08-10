import { uniq } from "es-toolkit";
import { parseSync, type Comment, type ParseResult } from "oxc-parser";

import {
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
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

const NODE_TYPE_FIELD = "type";

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const withoutRetiredTags = (commentValue: string): string =>
  RETIRED_ANNOTATION_TAGS.reduce((remaining, tag) => remaining.replaceAll(tag, ""), commentValue);

type TemplateLiteralFields = {
  readonly expressions: readonly unknown[];
  readonly quasis: readonly { readonly value: { readonly cooked: string } }[];
};

const literalValueOf = (node: Readonly<Record<string, unknown>>): CanonicalValue | null => {
  if (node[NODE_TYPE_FIELD] === "Literal") {
    const { value } = node;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return null;
  }
  if (node[NODE_TYPE_FIELD] !== "TemplateLiteral") return null;

  const { expressions, quasis } = node as TemplateLiteralFields;
  return expressions.length === 0 ? quasis[0].value.cooked : null;
};

const spelledOutValuesIn = (node: unknown): readonly CanonicalValue[] => {
  if (Array.isArray(node)) return node.flatMap(spelledOutValuesIn);
  if (node === null || typeof node !== "object") return [];

  const fields = node as Readonly<Record<string, unknown>>;
  if (typeof fields[NODE_TYPE_FIELD] !== "string") return [];

  const literal = literalValueOf(fields);
  if (literal !== null) return [literal];

  const keyField = KEY_FIELD_BY_NODE_TYPE.get(fields[NODE_TYPE_FIELD]);
  return Object.entries(fields)
    .filter(([field]) => field !== NODE_TYPE_FIELD && field !== keyField)
    .flatMap(([, value]) => spelledOutValuesIn(value));
};

const declarationAfter = (program: ParseResult["program"], comment: Comment): unknown =>
  program.body.find((statement) => statement.start >= comment.end) ?? null;

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

  const vocabulary = uniq(spelledOutValuesIn(declarationAfter(program, comment)));
  if (vocabulary.length === 0) {
    return {
      declarations: [],
      problems: [
        ...problems,
        { kind: "vocabulary-without-values", line, conceptId: annotation.conceptId },
      ],
    };
  }

  return {
    declarations: [{ conceptId: annotation.conceptId, values: vocabulary, line }],
    problems,
  };
};

export const scanCanonicalValuesText = (
  sourceText: string,
  sourceName: string = DEFAULT_SOURCE_NAME,
): CanonicalValuesTextScan => {
  const parsed = parseSync(sourceName, sourceText);
  const source: ParsedSource = { sourceText, program: parsed.program };
  const scans = parsed.comments.map((comment) => scanComment(source, comment));

  return {
    declarations: scans.flatMap((scan) => scan.declarations),
    problems: scans.flatMap((scan) => scan.problems),
  };
};
