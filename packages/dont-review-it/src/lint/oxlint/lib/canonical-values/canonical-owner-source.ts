import * as ts from "typescript-6";

import {
  canonicalOwnerCalledFunctions,
  canonicalOwnerReturnExpressions,
} from "./canonical-owner-call.ts";
import { canonicalOwnerPropertyInitializer } from "./canonical-owner-expression.ts";
import {
  addCanonicalOwnerSymbol,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const addExpressionSymbols = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const symbol = canonicalOwnerSymbolAtExpression(state.checker, expression);
  if (symbol === null) return false;
  const resolved = resolveTypeScriptSymbol(state.checker, symbol);
  const directSourceChanged = !state.sourceAliases.has(symbol);
  const resolvedSourceChanged = !state.sourceAliases.has(resolved);
  state.sourceAliases.add(symbol);
  state.sourceAliases.add(resolved);
  const directChanged = addCanonicalOwnerSymbol(state, symbol);
  const resolvedChanged = addCanonicalOwnerSymbol(state, resolved);
  return directSourceChanged || resolvedSourceChanged || directChanged || resolvedChanged;
};

const structuralSourceExpressions = (expression: ts.Expression): readonly ts.Expression[] => {
  if (ts.isAwaitExpression(expression)) return [expression.expression];
  if (ts.isConditionalExpression(expression)) return [expression.whenTrue, expression.whenFalse];
  if (ts.isCommaListExpression(expression)) {
    const last = expression.elements.at(-1);
    return last === undefined ? [] : [last];
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    return [expression.right];
  }
  return [];
};

const sourceExpressions = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): readonly ts.Expression[] => {
  const property = canonicalOwnerPropertyInitializer(state.checker, expression);
  const returned = ts.isCallExpression(expression)
    ? canonicalOwnerCalledFunctions(state.checker, expression.expression).flatMap(
        canonicalOwnerReturnExpressions,
      )
    : [];
  return [
    ...structuralSourceExpressions(expression),
    ...(property === null ? [] : [property]),
    ...returned,
  ];
};

const addSourceAliases = (resolution: {
  readonly expression: ts.Expression;
  readonly seen: Set<ts.Expression>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const expression = unwrapCanonicalOwnerExpression(resolution.expression);
  if (resolution.seen.has(expression)) return false;
  resolution.seen.add(expression);
  const directChanged = addExpressionSymbols(resolution.state, expression);
  const nestedChanges = sourceExpressions(resolution.state, expression).map((source) =>
    addSourceAliases({ ...resolution, expression: source }),
  );
  return directChanged || nestedChanges.some(Boolean);
};

export const addCanonicalOwnerSourceAliases = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => addSourceAliases({ expression, seen: new Set(), state });
