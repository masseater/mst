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

type LexedToken =
  | { readonly kind: "comment"; readonly bodyOffset: number; readonly value: string }
  | { readonly kind: "literal"; readonly value: CanonicalValue }
  | { readonly kind: "word"; readonly text: string }
  | { readonly kind: "punctuator"; readonly text: string };

type ScannedText = { readonly end: number; readonly cooked: string | null };

const WORD_START_PATTERN = /[A-Za-z_$]/u;
const WORD_PATTERN = /[A-Za-z_$][\w$]*/uy;
const DIGIT_PATTERN = /\d/u;
const NUMBER_PATTERN =
  /(?:0[bBoOxX][\da-fA-F_]+|(?:\d[\d_]*)?\.\d[\d_]*(?:[eE][+-]?\d+)?|\d[\d_]*(?:[eE][+-]?\d+)?)/uy;

const matchAt = (pattern: RegExp, text: string, index: number): string | null => {
  pattern.lastIndex = index;
  const matched = pattern.exec(text);
  return matched === null ? null : matched[0];
};

const REGEXP_ALLOWING_WORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "typeof",
  "void",
  "yield",
]);

const ESCAPED_CHARACTERS = new Map([
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
  ["b", "\b"],
  ["f", "\f"],
  ["v", "\v"],
  ["0", "\0"],
]);

const unescape = (character: string): string => ESCAPED_CHARACTERS.get(character) ?? character;

const scanQuoted = (text: string, start: number): ScannedText => {
  const quote = text[start];
  let index = start + 1;
  let cooked = "";
  while (index < text.length) {
    const character = text[index];
    if (character === "\n") return { end: index, cooked: null };
    if (character === "\\") {
      cooked += unescape(text.slice(index + 1, index + 2));
      index += 2;
      continue;
    }
    if (character === quote) return { end: index + 1, cooked };
    cooked += character;
    index += 1;
  }
  return { end: index, cooked: null };
};

const scanTemplate = (text: string, start: number): ScannedText => {
  let index = start + 1;
  let cooked = "";
  let substituted = false;
  let braceDepth = 0;
  while (index < text.length) {
    const character = text[index];
    if (braceDepth > 0) {
      if (character === "{") braceDepth += 1;
      else if (character === "}") braceDepth -= 1;
      else if (character === "`") {
        index = scanTemplate(text, index).end;
        continue;
      } else if (character === '"' || character === "'") {
        index = scanQuoted(text, index).end;
        continue;
      }
      index += 1;
      continue;
    }
    if (character === "\\") {
      cooked += unescape(text.slice(index + 1, index + 2));
      index += 2;
      continue;
    }
    if (character === "`") return { end: index + 1, cooked: substituted ? null : cooked };
    if (character === "$" && text[index + 1] === "{") {
      substituted = true;
      braceDepth = 1;
      index += 2;
      continue;
    }
    cooked += character;
    index += 1;
  }
  return { end: index, cooked: null };
};

const scanRegularExpression = (text: string, start: number): number => {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < text.length) {
    const character = text[index];
    if (character === "\n") return index;
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "[") inCharacterClass = true;
    else if (character === "]") inCharacterClass = false;
    else if (character === "/" && !inCharacterClass) return index + 1;
    index += 1;
  }
  return index;
};

const dividesAfter = (token: LexedToken): boolean => {
  if (token.kind === "literal") return true;
  if (token.kind === "word") return !REGEXP_ALLOWING_WORDS.has(token.text);
  if (token.kind === "punctuator") return token.text === ")" || token.text === "]";
  return false;
};

const KEY_SEPARATOR = ":";

const PUNCTUATORS = new Set(["{", "}", "[", "]", "(", ")", ";", KEY_SEPARATOR]);
const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

const tokenize = (text: string): readonly LexedToken[] => {
  const tokens: LexedToken[] = [];
  let index = 0;
  let dividing = false;
  const push = (token: LexedToken): void => {
    tokens.push(token);
    dividing = dividesAfter(token);
  };
  while (index < text.length) {
    const character = text[index];
    if (WHITESPACE.has(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && text[index + 1] === "/") {
      const lineEnd = text.indexOf("\n", index);
      const stop = lineEnd === -1 ? text.length : lineEnd;
      tokens.push({ kind: "comment", bodyOffset: index + 2, value: text.slice(index + 2, stop) });
      index = stop;
      continue;
    }
    if (character === "/" && text[index + 1] === "*") {
      const blockEnd = text.indexOf("*/", index + 2);
      const stop = blockEnd === -1 ? text.length : blockEnd;
      tokens.push({ kind: "comment", bodyOffset: index + 2, value: text.slice(index + 2, stop) });
      index = blockEnd === -1 ? text.length : blockEnd + 2;
      continue;
    }
    if (character === "/" && !dividing) {
      index = scanRegularExpression(text, index);
      dividing = true;
      continue;
    }
    if (character === '"' || character === "'") {
      const scanned = scanQuoted(text, index);
      if (scanned.cooked !== null) push({ kind: "literal", value: scanned.cooked });
      else dividing = false;
      index = scanned.end;
      continue;
    }
    if (character === "`") {
      const scanned = scanTemplate(text, index);
      if (scanned.cooked !== null) push({ kind: "literal", value: scanned.cooked });
      else dividing = true;
      index = scanned.end;
      continue;
    }
    if (
      DIGIT_PATTERN.test(character) ||
      (character === "." && DIGIT_PATTERN.test(text.slice(index + 1, index + 2)))
    ) {
      const matched = matchAt(NUMBER_PATTERN, text, index);
      if (matched === null) {
        index += 1;
        dividing = false;
        continue;
      }
      const numericSpelling = Number(matched.replaceAll("_", ""));
      if (Number.isNaN(numericSpelling)) dividing = false;
      else push({ kind: "literal", value: numericSpelling });
      index += matched.length;
      continue;
    }
    if (WORD_START_PATTERN.test(character)) {
      const word = matchAt(WORD_PATTERN, text, index) ?? character;
      if (word === "true" || word === "false") push({ kind: "literal", value: word === "true" });
      else push({ kind: "word", text: word });
      index += word.length;
      continue;
    }
    if (PUNCTUATORS.has(character)) {
      push({ kind: "punctuator", text: character });
      index += 1;
      continue;
    }
    index += 1;
    dividing = false;
  }
  return tokens;
};

const OPENING_PUNCTUATORS = new Set(["{", "[", "("]);
const CLOSING_PUNCTUATORS = new Set(["}", "]", ")"]);

const isPropertyKeyPosition = (
  tokens: readonly LexedToken[],
  position: number,
  openings: readonly string[],
): boolean => {
  if (openings.at(-1) !== "{") return false;
  for (let next = position + 1; next < tokens.length; next += 1) {
    const token = tokens[next];
    if (token.kind === "comment") continue;
    return token.kind === "punctuator" && token.text === KEY_SEPARATOR;
  }
  return false;
};

const collectDeclaredValues = (tokens: readonly LexedToken[]): readonly CanonicalValue[] => {
  const vocabulary: CanonicalValue[] = [];
  const openings: string[] = [];
  for (const [position, token] of tokens.entries()) {
    if (token.kind === "literal") {
      if (!isPropertyKeyPosition(tokens, position, openings)) vocabulary.push(token.value);
      continue;
    }
    if (token.kind !== "punctuator") continue;
    if (OPENING_PUNCTUATORS.has(token.text)) {
      openings.push(token.text);
      continue;
    }
    if (CLOSING_PUNCTUATORS.has(token.text)) {
      if (openings.length === 0) break;
      openings.pop();
      if (openings.length === 0 && token.text === "}") break;
      continue;
    }
    if (token.text === KEY_SEPARATOR) continue;
    if (openings.length === 0) break;
  }
  return [...new Set(vocabulary)];
};

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const withoutRetiredTags = (commentValue: string): string => {
  let remaining = commentValue;
  for (const tag of RETIRED_ANNOTATION_TAGS) remaining = remaining.replaceAll(tag, "");
  return remaining;
};

export const scanCanonicalValuesText = (sourceText: string): CanonicalValuesTextScan => {
  const declarations: CanonicalValuesDeclaration[] = [];
  const problems: CanonicalValuesTextProblem[] = [];
  const tokens = tokenize(sourceText);
  for (const [position, token] of tokens.entries()) {
    if (token.kind !== "comment") continue;
    for (const tag of findRetiredAnnotationTags(token.value)) {
      problems.push({
        kind: "retired-annotation-tag",
        line: lineAt(sourceText, token.bodyOffset + token.value.indexOf(tag)),
        tag,
      });
    }
    if (!containsCanonicalValuesAnnotation(withoutRetiredTags(token.value))) continue;
    const line = lineAt(sourceText, token.bodyOffset);
    const annotation = parseCanonicalValuesAnnotation(token.value);
    if (annotation === null) {
      problems.push({ kind: "unparsable-annotation", line });
      continue;
    }
    const vocabulary = collectDeclaredValues(tokens.slice(position + 1));
    if (vocabulary.length === 0) {
      problems.push({ kind: "vocabulary-without-values", line, conceptId: annotation.conceptId });
      continue;
    }
    declarations.push({ conceptId: annotation.conceptId, values: vocabulary, line });
  }
  return { declarations, problems };
};
