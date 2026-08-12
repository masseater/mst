import * as ts from "typescript-6";

import {
  canonicalOwnerProxyTrapFunctions,
  canonicalOwnerSymbolProtocolFunctions,
} from "./canonical-owner-execution-property.ts";
import {
  canonicalOwnerIsGlobalMethod,
  type CanonicalOwnerProtocolInput,
} from "./canonical-owner-execution-protocol-state.ts";
import { canonicalOwnerStaticPrimitive } from "./canonical-owner-nonthrow.ts";

import type { ExecutableFunction } from "./canonical-owner-state.ts";

const toPrimitiveFunctions = (
  input: CanonicalOwnerProtocolInput,
  expression: ts.Expression,
): readonly ExecutableFunction[] =>
  canonicalOwnerSymbolProtocolFunctions({
    ...input,
    expression,
    protocol: "toPrimitive",
  });

const coerciveBinaryOperators = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
]);

const looseEqualityExpressions = (expression: ts.BinaryExpression): readonly ts.Expression[] => {
  if (
    expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsToken &&
    expression.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsToken
  ) {
    return [];
  }
  const left = canonicalOwnerStaticPrimitive(expression.left);
  const right = canonicalOwnerStaticPrimitive(expression.right);
  return [
    ...(right !== undefined && right !== null ? [expression.left] : []),
    ...(left !== undefined && left !== null ? [expression.right] : []),
  ];
};

const binaryProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => {
  if (!ts.isBinaryExpression(input.node)) return [];
  if (input.node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
    return canonicalOwnerSymbolProtocolFunctions({
      ...input,
      expression: input.node.right,
      protocol: "hasInstance",
    });
  }
  if (input.node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
    return [
      ...toPrimitiveFunctions(input, input.node.left),
      ...canonicalOwnerProxyTrapFunctions({
        ...input,
        expression: input.node.right,
        trap: "has",
      }),
    ];
  }
  const expressions = coerciveBinaryOperators.has(input.node.operatorToken.kind)
    ? [input.node.left, input.node.right]
    : looseEqualityExpressions(input.node);
  return expressions.flatMap((expression) => toPrimitiveFunctions(input, expression));
};

const unaryProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  ts.isPrefixUnaryExpression(input.node) &&
  (input.node.operator === ts.SyntaxKind.PlusToken ||
    input.node.operator === ts.SyntaxKind.MinusToken ||
    input.node.operator === ts.SyntaxKind.TildeToken)
    ? toPrimitiveFunctions(input, input.node.operand)
    : [];

const syntacticPropertyKey = (node: ts.Node): ts.Expression | null => {
  if (ts.isElementAccessExpression(node)) return node.argumentExpression;
  if (ts.isComputedPropertyName(node)) return node.expression;
  return null;
};

const propertyKeyMethods: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Object", new Set(["defineProperty", "getOwnPropertyDescriptor", "hasOwn"])],
  [
    "Reflect",
    new Set(["defineProperty", "deleteProperty", "get", "getOwnPropertyDescriptor", "has", "set"]),
  ],
]);

const callPropertyKey = (input: CanonicalOwnerProtocolInput): ts.Expression | null => {
  if (!ts.isCallExpression(input.node)) return null;
  const call = input.node;
  const matches = [...propertyKeyMethods].some(([object, methods]) =>
    [...methods].some((method) => canonicalOwnerIsGlobalMethod({ ...input, call, method, object })),
  );
  return matches ? (call.arguments[1] ?? null) : null;
};

const propertyKeyProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => {
  const expression = syntacticPropertyKey(input.node) ?? callPropertyKey(input);
  return expression === null ? [] : toPrimitiveFunctions(input, expression);
};

const templateProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  ts.isTemplateSpan(input.node) ? toPrimitiveFunctions(input, input.node.expression) : [];

export const canonicalOwnerCoercionFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => [
  ...binaryProtocolFunctions(input),
  ...unaryProtocolFunctions(input),
  ...propertyKeyProtocolFunctions(input),
  ...templateProtocolFunctions(input),
];
