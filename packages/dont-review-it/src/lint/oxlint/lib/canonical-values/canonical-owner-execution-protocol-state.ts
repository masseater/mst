import * as ts from "typescript-6";

import { canonicalOwnerIdentifierIsGlobal } from "./canonical-owner-alias.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

export type CanonicalOwnerProtocolInput = {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
};

export const canonicalOwnerStaticPropertyText = (
  expression: ts.Expression | undefined,
): string | null => {
  if (expression === undefined) return null;
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isStringLiteralLike(current) || ts.isNumericLiteral(current) ? current.text : null;
};

export const canonicalOwnerIsGlobalMethod = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly method: string;
  readonly object: string;
  readonly program: ts.Program;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return (
    canonicalOwnerMemberName(input.call.expression) === input.method &&
    current !== null &&
    ts.isIdentifier(current) &&
    current.text === input.object &&
    canonicalOwnerIdentifierIsGlobal({ ...input, identifier: current })
  );
};

const referenceSymbol = (checker: ts.TypeChecker, expression: ts.Expression): ts.Symbol | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (!ts.isIdentifier(current)) return null;
  const symbol = canonicalOwnerSymbolAtExpression(checker, current);
  return symbol === null ? null : resolveTypeScriptSymbol(checker, symbol);
};

export const canonicalOwnerSameReference = (input: {
  readonly checker: ts.TypeChecker;
  readonly left: ts.Expression;
  readonly right: ts.Expression;
}): boolean => {
  const leftSymbol = referenceSymbol(input.checker, input.left);
  return leftSymbol !== null && leftSymbol === referenceSymbol(input.checker, input.right);
};
