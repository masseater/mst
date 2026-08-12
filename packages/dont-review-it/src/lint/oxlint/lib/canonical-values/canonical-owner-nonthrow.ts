import * as ts from "typescript-6";

import { unwrapCanonicalOwnerExpression } from "./canonical-owner-state.ts";

export type CanonicalOwnerStaticPrimitive = string | number | boolean | null | undefined;

const primitiveIsTruthy = (primitive: CanonicalOwnerStaticPrimitive): boolean =>
  primitive !== undefined &&
  primitive !== null &&
  primitive !== false &&
  primitive !== 0 &&
  primitive !== "";

const prefixPrimitive = (expression: ts.PrefixUnaryExpression): CanonicalOwnerStaticPrimitive => {
  const operand = canonicalOwnerStaticPrimitive(expression.operand);
  if (expression.operator === ts.SyntaxKind.ExclamationToken) return !primitiveIsTruthy(operand);
  if (typeof operand !== "number") return undefined;
  if (expression.operator === ts.SyntaxKind.MinusToken) return -operand;
  return expression.operator === ts.SyntaxKind.PlusToken ? operand : undefined;
};

export const canonicalOwnerStaticPrimitive = (
  expression: ts.Expression,
): CanonicalOwnerStaticPrimitive => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isStringLiteralLike(current)) return current.text;
  if (ts.isNumericLiteral(current)) return Number(current.text);
  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (current.kind === ts.SyntaxKind.NullKeyword) return null;
  return ts.isPrefixUnaryExpression(current) ? prefixPrimitive(current) : undefined;
};

const binaryBoolean = (expression: ts.BinaryExpression): boolean | null => {
  const left = canonicalOwnerStaticPrimitive(expression.left);
  const right = canonicalOwnerStaticPrimitive(expression.right);
  if (left === undefined || right === undefined) return null;
  if (expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
    return left === right;
  }
  return expression.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    ? left !== right
    : null;
};

export const canonicalOwnerStaticBoolean = (expression: ts.Expression): boolean | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  const primitive = canonicalOwnerStaticPrimitive(current);
  if (primitive !== undefined) return primitiveIsTruthy(primitive);
  return ts.isBinaryExpression(current) ? binaryBoolean(current) : null;
};

const directExpressionIsDefinitelyNonThrowing = (expression: ts.Expression): boolean =>
  ts.isLiteralExpression(expression) ||
  ts.isIdentifier(expression) ||
  ts.isArrowFunction(expression) ||
  ts.isFunctionExpression(expression) ||
  expression.kind === ts.SyntaxKind.TrueKeyword ||
  expression.kind === ts.SyntaxKind.FalseKeyword ||
  expression.kind === ts.SyntaxKind.NullKeyword;

const NON_COERCING_BINARY_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.CommaToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

const PRIMITIVE_BINARY_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const binaryExpressionIsDefinitelyNonThrowing = (expression: ts.BinaryExpression): boolean => {
  const operator = expression.operatorToken.kind;
  if (NON_COERCING_BINARY_OPERATORS.has(operator)) {
    return (
      expressionIsDefinitelyNonThrowing(expression.left) &&
      expressionIsDefinitelyNonThrowing(expression.right)
    );
  }
  return (
    PRIMITIVE_BINARY_OPERATORS.has(operator) &&
    canonicalOwnerStaticPrimitive(expression.left) !== undefined &&
    canonicalOwnerStaticPrimitive(expression.right) !== undefined
  );
};

const prefixExpressionIsDefinitelyNonThrowing = (expression: ts.PrefixUnaryExpression): boolean =>
  expression.operator === ts.SyntaxKind.ExclamationToken
    ? expressionIsDefinitelyNonThrowing(expression.operand)
    : canonicalOwnerStaticPrimitive(expression.operand) !== undefined;

const conditionalExpressionIsDefinitelyNonThrowing = (
  expression: ts.ConditionalExpression,
): boolean =>
  expressionIsDefinitelyNonThrowing(expression.condition) &&
  expressionIsDefinitelyNonThrowing(expression.whenTrue) &&
  expressionIsDefinitelyNonThrowing(expression.whenFalse);

const expressionIsDefinitelyNonThrowing = (expression: ts.Expression): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (directExpressionIsDefinitelyNonThrowing(current)) return true;
  if (ts.isPrefixUnaryExpression(current)) {
    return prefixExpressionIsDefinitelyNonThrowing(current);
  }
  if (ts.isVoidExpression(current) || ts.isTypeOfExpression(current)) {
    return expressionIsDefinitelyNonThrowing(current.expression);
  }
  if (ts.isBinaryExpression(current)) return binaryExpressionIsDefinitelyNonThrowing(current);
  return ts.isConditionalExpression(current)
    ? conditionalExpressionIsDefinitelyNonThrowing(current)
    : false;
};

type BindingResolution = (input: {
  readonly initializer: ts.Expression;
  readonly name: ts.BindingName;
}) => boolean;

const bindingElementSource = (
  object: ts.ObjectLiteralExpression,
  element: ts.BindingElement,
): ts.Expression | null => {
  if (element.dotDotDotToken !== undefined) return null;
  const bindingName = element.propertyName ?? element.name;
  if (!ts.isIdentifier(bindingName) && !ts.isStringLiteralLike(bindingName)) return null;
  const property = object.properties.find((candidate) => {
    if (!ts.isPropertyAssignment(candidate) && !ts.isShorthandPropertyAssignment(candidate)) {
      return false;
    }
    const name = candidate.name;
    return (
      (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) &&
      name.text === bindingName.text
    );
  });
  if (property === undefined) return null;
  if (ts.isPropertyAssignment(property)) return property.initializer;
  return ts.isShorthandPropertyAssignment(property) ? property.name : null;
};

const objectBindingIsDefinitelyNonThrowing = (input: {
  readonly initializer: ts.Expression;
  readonly name: ts.ObjectBindingPattern;
  readonly resolve: BindingResolution;
}): boolean => {
  const object = unwrapCanonicalOwnerExpression(input.initializer);
  if (!ts.isObjectLiteralExpression(object)) return false;
  return input.name.elements.every((element) => {
    const source = bindingElementSource(object, element);
    return (
      source !== null &&
      (element.initializer === undefined ||
        expressionIsDefinitelyNonThrowing(element.initializer)) &&
      input.resolve({ initializer: source, name: element.name })
    );
  });
};

const arrayBindingIsDefinitelyNonThrowing = (input: {
  readonly initializer: ts.Expression;
  readonly name: ts.ArrayBindingPattern;
  readonly resolve: BindingResolution;
}): boolean => {
  const array = unwrapCanonicalOwnerExpression(input.initializer);
  if (!ts.isArrayLiteralExpression(array)) return false;
  return input.name.elements.every((element, index) => {
    if (ts.isOmittedExpression(element)) return true;
    const source = array.elements[index];
    return (
      element.dotDotDotToken === undefined &&
      source !== undefined &&
      !ts.isOmittedExpression(source) &&
      !ts.isSpreadElement(source) &&
      (element.initializer === undefined ||
        expressionIsDefinitelyNonThrowing(element.initializer)) &&
      input.resolve({ initializer: source, name: element.name })
    );
  });
};

const bindingIsDefinitelyNonThrowing: BindingResolution = (input) => {
  if (ts.isIdentifier(input.name)) return expressionIsDefinitelyNonThrowing(input.initializer);
  if (ts.isObjectBindingPattern(input.name)) {
    return objectBindingIsDefinitelyNonThrowing({
      initializer: input.initializer,
      name: input.name,
      resolve: bindingIsDefinitelyNonThrowing,
    });
  }
  return arrayBindingIsDefinitelyNonThrowing({
    initializer: input.initializer,
    name: input.name,
    resolve: bindingIsDefinitelyNonThrowing,
  });
};

const variableDeclarationIsDefinitelyNonThrowing = (declaration: ts.VariableDeclaration): boolean =>
  declaration.initializer === undefined ||
  bindingIsDefinitelyNonThrowing({
    initializer: declaration.initializer,
    name: declaration.name,
  });

export const canonicalOwnerStatementIsDefinitelyNonThrowing = (
  statement: ts.Statement,
): boolean => {
  if (ts.isEmptyStatement(statement)) return true;
  if (ts.isExpressionStatement(statement)) {
    return expressionIsDefinitelyNonThrowing(statement.expression);
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.every(variableDeclarationIsDefinitelyNonThrowing);
  }
  return ts.isBlock(statement)
    ? statement.statements.every(canonicalOwnerStatementIsDefinitelyNonThrowing)
    : false;
};
