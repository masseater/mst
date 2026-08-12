import * as ts from "typescript-6";

import {
  canonicalOwnerCalledFunctions,
  canonicalOwnerReturnExpressions,
} from "./canonical-owner-call.ts";
import { canonicalOwnerPropertyInitializer } from "./canonical-owner-expression.ts";
import { canonicalOwnerDefaultLibraryExpressionIsStable } from "./canonical-owner-standard-stability.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerResolvedSymbolAtExpression,
} from "./canonical-owner-state.ts";

import type { CanonicalValue } from "./fingerprint.ts";

export type RuntimeSequenceResolution = {
  readonly checker: ts.TypeChecker;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
  readonly seenFunctions: ReadonlySet<ts.FunctionLikeDeclaration>;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
};

export type RuntimeExpressionSource = {
  readonly expression: ts.Expression;
  readonly resolution: RuntimeSequenceResolution;
};

export const unwrapRuntimeExpression = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return unwrapRuntimeExpression(expression.expression);
  }
  return expression;
};

const prefixPrimitive = (expression: ts.PrefixUnaryExpression): number | undefined => {
  const operand = runtimePrimitive(expression.operand);
  if (typeof operand !== "number") return undefined;
  if (expression.operator === ts.SyntaxKind.MinusToken) return -operand;
  return expression.operator === ts.SyntaxKind.PlusToken ? operand : undefined;
};

export const runtimePrimitive = (expression: ts.Expression): CanonicalValue | undefined => {
  const current = unwrapRuntimeExpression(expression);
  if (ts.isStringLiteralLike(current)) return current.text;
  if (ts.isNumericLiteral(current)) return Number(current.text);
  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (current.kind === ts.SyntaxKind.NullKeyword) return null;
  return ts.isPrefixUnaryExpression(current) ? prefixPrimitive(current) : undefined;
};

const sourceFileExpression = (declaration: ts.Declaration | undefined): ts.Expression | null => {
  if (declaration === undefined || !ts.isSourceFile(declaration)) return null;
  const statement = declaration.statements[0];
  return statement !== undefined && ts.isExpressionStatement(statement)
    ? statement.expression
    : null;
};

const declarationInitializer = (declaration: ts.Declaration | undefined): ts.Expression | null => {
  const sourceExpression = sourceFileExpression(declaration);
  if (sourceExpression !== null) return sourceExpression;
  if (
    declaration !== undefined &&
    (ts.isVariableDeclaration(declaration) ||
      ts.isPropertyAssignment(declaration) ||
      ts.isPropertyDeclaration(declaration))
  ) {
    return declaration.initializer ?? null;
  }
  return declaration !== undefined && ts.isShorthandPropertyAssignment(declaration)
    ? declaration.name
    : null;
};

const IDENTITY_OBJECT_METHODS: ReadonlySet<string> = new Set([
  "freeze",
  "preventExtensions",
  "seal",
]);

const callIsObjectIdentity = (
  expression: ts.CallExpression,
): { readonly callee: ts.Expression; readonly source: ts.Expression } | null => {
  const receiver = canonicalOwnerMemberReceiver(expression.expression);
  const name = canonicalOwnerMemberName(expression.expression);
  const current = receiver === null ? null : unwrapRuntimeExpression(receiver);
  const source = expression.arguments[0];
  return current !== null &&
    ts.isIdentifier(current) &&
    current.text === "Object" &&
    IDENTITY_OBJECT_METHODS.has(name ?? "") &&
    source !== undefined
    ? { callee: expression.expression, source }
    : null;
};

const identityCallSource = (
  resolution: RuntimeSequenceResolution,
  expression: ts.CallExpression,
): ts.Expression | null => {
  const identity = callIsObjectIdentity(expression);
  if (identity === null) return null;
  return canonicalOwnerDefaultLibraryExpressionIsStable({
    ...resolution,
    expression: identity.callee,
  })
    ? identity.source
    : null;
};

const initializerForSymbol = (
  resolution: RuntimeSequenceResolution,
  symbol: ts.Symbol,
): ts.Expression | null =>
  resolution.seenSymbols.has(symbol)
    ? null
    : declarationInitializer(symbol.valueDeclaration ?? symbol.declarations?.[0]);

const propertyKey = (
  expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): string | null => {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return ts.isStringLiteralLike(expression.argumentExpression) ||
    ts.isNumericLiteral(expression.argumentExpression)
    ? expression.argumentExpression.text
    : null;
};

const receiverInitializer = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): ts.Expression => {
  const receiver = unwrapRuntimeExpression(expression);
  const symbol = canonicalOwnerResolvedSymbolAtExpression(resolution.checker, receiver);
  const initializer = symbol === null ? null : initializerForSymbol(resolution, symbol);
  return initializer === null ? receiver : unwrapRuntimeExpression(initializer);
};

const containerElement = (container: ts.Expression, key: string): ts.Expression | null => {
  if (ts.isArrayLiteralExpression(container)) {
    const element = container.elements[Number(key)];
    return element === undefined || ts.isOmittedExpression(element) || ts.isSpreadElement(element)
      ? null
      : element;
  }
  if (!ts.isObjectLiteralExpression(container)) return null;
  const property = container.properties.find((candidate) => {
    if (!ts.isPropertyAssignment(candidate) && !ts.isShorthandPropertyAssignment(candidate)) {
      return false;
    }
    const name = candidate.name;
    return (
      (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) &&
      name.text === key
    );
  });
  if (property === undefined) return null;
  if (ts.isPropertyAssignment(property)) return property.initializer;
  return ts.isShorthandPropertyAssignment(property) ? property.name : null;
};

const propertyInitializer = (
  resolution: RuntimeSequenceResolution,
  expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): ts.Expression | null => {
  const symbol = canonicalOwnerResolvedSymbolAtExpression(resolution.checker, expression);
  const direct = symbol === null ? null : initializerForSymbol(resolution, symbol);
  if (direct !== null) return direct;
  const staticProperty = canonicalOwnerPropertyInitializer(resolution.checker, expression);
  if (staticProperty !== null) return staticProperty;
  const key = propertyKey(expression);
  return key === null
    ? null
    : containerElement(receiverInitializer(resolution, expression.expression), key);
};

const conditionalSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.ConditionalExpression,
): readonly RuntimeExpressionSource[] | null => {
  const whenTrue = runtimeExpressionSources(resolution, expression.whenTrue);
  const whenFalse = runtimeExpressionSources(resolution, expression.whenFalse);
  return whenTrue === null || whenFalse === null ? null : [...whenTrue, ...whenFalse];
};

const identifierSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Identifier,
): readonly RuntimeExpressionSource[] | null => {
  const symbol = canonicalOwnerResolvedSymbolAtExpression(resolution.checker, expression);
  if (symbol === null || resolution.seenSymbols.has(symbol)) return null;
  const initializer = initializerForSymbol(resolution, symbol);
  return initializer === null
    ? null
    : runtimeExpressionSources(
        { ...resolution, seenSymbols: new Set([...resolution.seenSymbols, symbol]) },
        initializer,
      );
};

const callSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.CallExpression,
): readonly RuntimeExpressionSource[] | null => {
  const identitySource = identityCallSource(resolution, expression);
  if (identitySource !== null) return runtimeExpressionSources(resolution, identitySource);
  const functions = canonicalOwnerCalledFunctions(resolution.checker, expression.expression).filter(
    (function_) => !resolution.seenFunctions.has(function_),
  );
  if (functions.length === 0) return null;
  const returned = functions.flatMap((function_) =>
    canonicalOwnerReturnExpressions(function_).map((returnedExpression) => ({
      expression: returnedExpression,
      resolution: {
        ...resolution,
        seenFunctions: new Set([...resolution.seenFunctions, function_]),
      },
    })),
  );
  return returned.length === 0 ? null : returned;
};

const binaryValueExpression = (expression: ts.Expression): ts.Expression | null =>
  ts.isBinaryExpression(expression) &&
  (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
    expression.operatorToken.kind === ts.SyntaxKind.CommaToken)
    ? expression.right
    : null;

const structuralSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): readonly RuntimeExpressionSource[] | null | undefined => {
  if (ts.isAwaitExpression(expression)) {
    return runtimeExpressionSources(resolution, expression.expression);
  }
  if (ts.isConditionalExpression(expression)) return conditionalSources(resolution, expression);
  const binaryValue = binaryValueExpression(expression);
  if (binaryValue !== null) return runtimeExpressionSources(resolution, binaryValue);
  if (!ts.isCommaListExpression(expression)) return undefined;
  const last = expression.elements.at(-1);
  return last === undefined ? null : runtimeExpressionSources(resolution, last);
};

const referenceSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): readonly RuntimeExpressionSource[] | null => {
  if (ts.isIdentifier(expression)) return identifierSources(resolution, expression);
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    const initializer = propertyInitializer(resolution, expression);
    return initializer === null ? null : runtimeExpressionSources(resolution, initializer);
  }
  if (ts.isCallExpression(expression)) return callSources(resolution, expression);
  return [{ expression, resolution }];
};

export const runtimeExpressionSources = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): readonly RuntimeExpressionSource[] | null => {
  const current = unwrapRuntimeExpression(expression);
  const structural = structuralSources(resolution, current);
  return structural === undefined ? referenceSources(resolution, current) : structural;
};
