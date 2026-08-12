import { decodeHTMLStrict } from "entities";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { resolveCanonicalValueDirectStaticPrimitive } from "./canonical-value-static-primitive.ts";

import type { ESTree, Visitor } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";

type LiteralNode =
  | ESTree.BigIntLiteral
  | ESTree.BooleanLiteral
  | ESTree.NullLiteral
  | ESTree.NumericLiteral
  | ESTree.RegExpLiteral
  | ESTree.StringLiteral;

export type CanonicalLiteralCandidate = {
  readonly ancestors: readonly ESTree.Node[];
  readonly node: ESTree.Node;
  readonly spelling: CanonicalValue;
};

type CandidateInspection = (candidate: CanonicalLiteralCandidate) => void;

export const canonicalLiteralAncestorsOf = (node: ESTree.Node): readonly ESTree.Node[] =>
  node.parent === null ? [] : [...canonicalLiteralAncestorsOf(node.parent), node.parent];

const literalSpelling = (node: LiteralNode): CanonicalValue | undefined => {
  const literal = node.value;
  if (literal === null) return null;
  if (typeof literal === "string") {
    return node.parent.type === "JSXAttribute" && node.parent.value === node
      ? decodeHTMLStrict(literal)
      : literal;
  }
  if (typeof literal === "number" || typeof literal === "boolean") return literal;
  return undefined;
};

const signedNumericSpelling = (node: ESTree.UnaryExpression): number | undefined => {
  if (node.operator !== "-" && node.operator !== "+") return undefined;
  const argument = unwrapExpression(node.argument);
  const numericSpelling =
    argument.type === "Literal" && typeof argument.value === "number"
      ? argument.value
      : argument.type === "UnaryExpression"
        ? signedNumericSpelling(argument)
        : undefined;
  if (numericSpelling === undefined) return undefined;
  return node.operator === "-" ? -numericSpelling : numericSpelling;
};

const isTransparentExpression = (node: ESTree.Node): boolean =>
  node.type === "ParenthesizedExpression" ||
  node.type === "TSAsExpression" ||
  node.type === "TSNonNullExpression" ||
  node.type === "TSSatisfiesExpression" ||
  node.type === "TSTypeAssertion";

const hasEnclosingSignedNumericExpression = (ancestors: readonly ESTree.Node[]): boolean => {
  for (const ancestor of ancestors.toReversed()) {
    if (isTransparentExpression(ancestor)) continue;
    return (
      ancestor.type === "UnaryExpression" &&
      (ancestor.operator === "-" || ancestor.operator === "+")
    );
  }
  return false;
};

const directStaticSpelling = (expression: ESTree.Expression): CanonicalValue | undefined => {
  const primitives = resolveCanonicalValueDirectStaticPrimitive(expression);
  const [only] = primitives.candidates;
  if (!primitives.complete || primitives.candidates.length !== 1) return undefined;
  return only === undefined || typeof only === "bigint" ? undefined : only;
};

const hasEnclosingStaticExpression = (ancestors: readonly ESTree.Node[]): boolean => {
  for (const ancestor of ancestors.toReversed()) {
    if (isTransparentExpression(ancestor)) continue;
    if (ancestor.type !== "BinaryExpression" && ancestor.type !== "TemplateLiteral") {
      return false;
    }
    return directStaticSpelling(ancestor) !== undefined;
  }
  return false;
};

const templateLiteralSpelling = (node: ESTree.TemplateLiteral): CanonicalValue | undefined => {
  if (node.expressions.length !== 0 || node.quasis.length !== 1) return undefined;
  return node.quasis[0]?.value.cooked ?? undefined;
};

const inspectLiteral = (node: LiteralNode, inspect: CandidateInspection): void => {
  const spelling = literalSpelling(node);
  if (spelling === undefined) return;
  const ancestors = canonicalLiteralAncestorsOf(node);
  if (hasEnclosingStaticExpression(ancestors)) return;
  if (typeof spelling === "number" && hasEnclosingSignedNumericExpression(ancestors)) return;
  inspect({ ancestors, node, spelling });
};

const jsxTextSpelling = (value: string): string => {
  const lines = value.split(/\r\n|\n|\r/u);
  const lastNonEmptyLine = lines.findLastIndex((line) => /[^ \t]/u.test(line));
  return decodeHTMLStrict(
    lines
      .map((line, index) => {
        const firstLine = index === 0;
        const lastLine = index === lines.length - 1;
        const tabsAsSpaces = line.replaceAll("\t", " ");
        const leadingTrimmed = firstLine ? tabsAsSpaces : tabsAsSpaces.replace(/^ +/u, "");
        const rendered = lastLine ? leadingTrimmed : leadingTrimmed.replace(/ +$/u, "");
        if (rendered === "") return "";
        return index === lastNonEmptyLine ? rendered : `${rendered} `;
      })
      .join(""),
  );
};

const inspectJsxText = (node: ESTree.JSXText, inspect: CandidateInspection): void => {
  const spelling = jsxTextSpelling(node.value);
  if (spelling === "") return;
  inspect({ ancestors: canonicalLiteralAncestorsOf(node), node, spelling });
};

export const inspectCanonicalLiteralTemplateLiteral = (
  node: ESTree.TemplateLiteral,
  inspect: CandidateInspection,
): void => {
  const ancestors = canonicalLiteralAncestorsOf(node);
  if (hasEnclosingStaticExpression(ancestors)) return;
  const spelling = directStaticSpelling(node) ?? templateLiteralSpelling(node);
  if (spelling === undefined) return;
  inspect({ ancestors, node, spelling });
};

export const inspectCanonicalLiteralBinaryExpression = (
  node: ESTree.BinaryExpression,
  inspect: CandidateInspection,
): void => {
  const ancestors = canonicalLiteralAncestorsOf(node);
  if (hasEnclosingStaticExpression(ancestors)) return;
  const spelling = directStaticSpelling(node);
  if (spelling === undefined) return;
  inspect({ ancestors, node, spelling });
};

export const inspectCanonicalLiteralUnaryExpression = (
  node: ESTree.UnaryExpression,
  inspect: CandidateInspection,
): void => {
  const ancestors = canonicalLiteralAncestorsOf(node);
  if (hasEnclosingSignedNumericExpression(ancestors)) return;
  const spelling = signedNumericSpelling(node);
  if (spelling === undefined) return;
  inspect({ ancestors, node, spelling });
};

const createCanonicalLiteralVisitor = (
  inspect: CandidateInspection,
  hooks: {
    readonly recordStaticExpression?: (
      node: ESTree.BinaryExpression | ESTree.TemplateLiteral,
    ) => void;
  } = {},
): Visitor => ({
  BinaryExpression(node: ESTree.BinaryExpression) {
    inspectCanonicalLiteralBinaryExpression(node, inspect);
    hooks.recordStaticExpression?.(node);
  },
  JSXText(node: ESTree.JSXText) {
    inspectJsxText(node, inspect);
  },
  Literal(node: LiteralNode) {
    inspectLiteral(node, inspect);
  },
  TemplateLiteral(node: ESTree.TemplateLiteral) {
    inspectCanonicalLiteralTemplateLiteral(node, inspect);
    hooks.recordStaticExpression?.(node);
  },
  TSNullKeyword(node: ESTree.TSNullKeyword) {
    inspect({ ancestors: canonicalLiteralAncestorsOf(node), node, spelling: null });
  },
});

export { createCanonicalLiteralVisitor };
