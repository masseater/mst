import * as ts from "typescript-6";

import {
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const targetSymbols = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): readonly ts.Symbol[] => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isIdentifier(current)) {
    const symbol = state.checker.getSymbolAtLocation(current);
    return symbol === undefined ? [] : [resolveTypeScriptSymbol(state.checker, symbol)];
  }
  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.flatMap((element) =>
      ts.isOmittedExpression(element)
        ? []
        : targetSymbols(state, ts.isSpreadElement(element) ? element.expression : element),
    );
  }
  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.flatMap((property) => {
      if (ts.isShorthandPropertyAssignment(property)) {
        return targetSymbols(state, property.name);
      }
      if (ts.isPropertyAssignment(property)) {
        return targetSymbols(state, property.initializer);
      }
      return ts.isSpreadAssignment(property) ? targetSymbols(state, property.expression) : [];
    });
  }
  return [];
};

const assignmentTarget = (node: ts.Node): ts.Expression | null =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
  node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ? node.left
    : null;

const sourceWritePrecedesCapture = (input: {
  readonly declaration: ts.VariableDeclaration;
  readonly node: ts.Node;
}): boolean => {
  const ownerSource = input.declaration.getSourceFile();
  const writeSource = input.node.getSourceFile();
  return (
    writeSource !== ownerSource ||
    input.node.getStart(writeSource) < input.declaration.getStart(ownerSource)
  );
};

export const canonicalOwnerBindingWriteMutates = (input: {
  readonly declaration: ts.VariableDeclaration;
  readonly node: ts.Node;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const target = assignmentTarget(input.node);
  if (target === null) return false;
  const symbols = targetSymbols(input.state, target);
  if (symbols.includes(input.state.owner)) return true;
  return (
    sourceWritePrecedesCapture(input) &&
    symbols.some((symbol) => input.state.sourceAliases.has(symbol))
  );
};
