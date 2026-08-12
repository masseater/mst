import * as ts from "typescript-6";

import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

export type ExecutableFunction = ts.FunctionLikeDeclaration & { readonly body: ts.ConciseBody };

export type CanonicalOwnerAliasState = {
  readonly addresses: Map<ts.Symbol, Set<string>>;
  readonly aliases: Set<ts.Symbol>;
  readonly checker: ts.TypeChecker;
  readonly nodes: readonly ts.Node[];
  readonly owner: ts.Symbol;
  readonly program: ts.Program;
  readonly sourceAliases: Set<ts.Symbol>;
};

export const canonicalOwnerDeclarationInitializer = (
  declaration: ts.Declaration,
): ts.Expression | null => {
  if (
    ts.isVariableDeclaration(declaration) ||
    ts.isPropertyAssignment(declaration) ||
    ts.isPropertyDeclaration(declaration)
  ) {
    return declaration.initializer ?? null;
  }
  return null;
};

export const unwrapCanonicalOwnerExpression = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return unwrapCanonicalOwnerExpression(expression.expression);
  }
  return expression;
};

export const canonicalOwnerMemberName = (expression: ts.Expression): string | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isPropertyAccessExpression(current)) return current.name.text;
  if (!ts.isElementAccessExpression(current)) return null;
  const argument = current.argumentExpression;
  if (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument)) return argument.text;
  return argument.kind === ts.SyntaxKind.TrueKeyword
    ? "true"
    : argument.kind === ts.SyntaxKind.FalseKeyword
      ? "false"
      : null;
};

export const canonicalOwnerMemberReceiver = (expression: ts.Expression): ts.Expression | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)
    ? current.expression
    : null;
};

export const canonicalOwnerSymbolAtExpression = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.Symbol | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  const location = ts.isPropertyAccessExpression(current)
    ? current.name
    : ts.isElementAccessExpression(current)
      ? current.argumentExpression
      : ts.isIdentifier(current)
        ? current
        : null;
  return location === null ? null : (checker.getSymbolAtLocation(location) ?? null);
};

export const canonicalOwnerResolvedSymbolAtExpression = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.Symbol | null => {
  const symbol = canonicalOwnerSymbolAtExpression(checker, expression);
  return symbol === null ? null : resolveTypeScriptSymbol(checker, symbol);
};

export const addCanonicalOwnerSymbol = (
  state: CanonicalOwnerAliasState,
  symbol: ts.Symbol | undefined,
): boolean => {
  if (symbol === undefined || state.aliases.has(symbol)) return false;
  state.aliases.add(symbol);
  return true;
};

export const canonicalOwnerSymbolIs = (
  state: CanonicalOwnerAliasState,
  symbol: ts.Symbol | null,
): boolean =>
  symbol !== null &&
  (state.aliases.has(symbol) || state.aliases.has(resolveTypeScriptSymbol(state.checker, symbol)));
