import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueGuard } from "./canonical-value-binding-types.ts";
import type { CanonicalValueGuardExecution } from "./canonical-value-property-static.ts";

type CatchExecutionInput = {
  readonly guard: Extract<CanonicalValueGuard, { readonly kind: "catch" }>;
  readonly resolvedPrimitive: (expression: ESTree.Expression) => boolean;
};

const unaryExpressionIsNonThrowing = (
  expression: ESTree.UnaryExpression,
  input: CatchExecutionInput,
): boolean => {
  if (!expressionIsNonThrowing(expression.argument, input)) return false;
  return (
    expression.operator === "!" ||
    expression.operator === "typeof" ||
    expression.operator === "void" ||
    input.resolvedPrimitive(expression)
  );
};

const leafExpressionIsNonThrowing = (
  expression: ESTree.Expression,
  input: CatchExecutionInput,
): boolean | null => {
  if (expression.type === "Literal") return !("regex" in expression);
  if (expression.type === "Identifier") return input.resolvedPrimitive(expression);
  if (expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression") {
    return true;
  }
  return null;
};

const binaryExpressionIsNonThrowing = (
  expression: Extract<ESTree.Expression, { readonly type: "BinaryExpression" }>,
  input: CatchExecutionInput,
): boolean => {
  if (expression.left.type === "PrivateIdentifier") return false;
  return (
    expressionIsNonThrowing(expression.left, input) &&
    expressionIsNonThrowing(expression.right, input) &&
    input.resolvedPrimitive(expression)
  );
};

const branchingExpressionIsNonThrowing = (
  expression: ESTree.ConditionalExpression | ESTree.LogicalExpression,
  input: CatchExecutionInput,
): boolean => {
  if (expression.type === "LogicalExpression") {
    return (
      expressionIsNonThrowing(expression.left, input) &&
      expressionIsNonThrowing(expression.right, input)
    );
  }
  return (
    expressionIsNonThrowing(expression.test, input) &&
    expressionIsNonThrowing(expression.consequent, input) &&
    expressionIsNonThrowing(expression.alternate, input)
  );
};

const compoundExpressionIsNonThrowing = (
  expression: ESTree.Expression,
  input: CatchExecutionInput,
): boolean => {
  if (expression.type === "UnaryExpression") return unaryExpressionIsNonThrowing(expression, input);
  if (expression.type === "BinaryExpression")
    return binaryExpressionIsNonThrowing(expression, input);
  if (expression.type === "LogicalExpression" || expression.type === "ConditionalExpression") {
    return branchingExpressionIsNonThrowing(expression, input);
  }
  if (expression.type === "SequenceExpression") {
    return expression.expressions.every((candidate) => expressionIsNonThrowing(candidate, input));
  }
  if (expression.type === "TemplateLiteral") {
    return (
      expression.expressions.every((candidate) => expressionIsNonThrowing(candidate, input)) &&
      input.resolvedPrimitive(expression)
    );
  }
  return false;
};

const expressionIsNonThrowing = (
  rawExpression: ESTree.Expression,
  input: CatchExecutionInput,
): boolean => {
  const expression = unwrapExpression(rawExpression);
  return (
    leafExpressionIsNonThrowing(expression, input) ??
    compoundExpressionIsNonThrowing(expression, input)
  );
};

const declarationIsNonThrowing = (
  declaration: ESTree.VariableDeclaration,
  input: CatchExecutionInput,
): boolean =>
  declaration.declarations.every(
    (declarator) =>
      declarator.id.type === "Identifier" &&
      (declarator.init === null || expressionIsNonThrowing(declarator.init, input)),
  );

const DIRECTLY_NON_THROWING_STATEMENTS = [
  "BreakStatement",
  "ContinueStatement",
  "DebuggerStatement",
  "EmptyStatement",
  "FunctionDeclaration",
] as const;

const directStatementIsNonThrowing = (
  statement: ESTree.Statement,
  input: CatchExecutionInput,
): boolean | null => {
  if (DIRECTLY_NON_THROWING_STATEMENTS.some((type) => type === statement.type)) return true;
  if (statement.type === "ExpressionStatement") {
    return expressionIsNonThrowing(statement.expression, input);
  }
  if (statement.type === "VariableDeclaration") return declarationIsNonThrowing(statement, input);
  if (statement.type === "ReturnStatement") {
    return statement.argument === null || expressionIsNonThrowing(statement.argument, input);
  }
  return null;
};

const compoundStatementIsNonThrowing = (
  statement: ESTree.Statement,
  input: CatchExecutionInput,
): boolean => {
  if (statement.type === "BlockStatement") return blockIsNonThrowing(statement, input);
  if (statement.type === "LabeledStatement") return statementIsNonThrowing(statement.body, input);
  if (statement.type !== "IfStatement" || !expressionIsNonThrowing(statement.test, input)) {
    return false;
  }
  return (
    statementIsNonThrowing(statement.consequent, input) &&
    (statement.alternate === null || statementIsNonThrowing(statement.alternate, input))
  );
};

const statementIsNonThrowing = (statement: ESTree.Statement, input: CatchExecutionInput): boolean =>
  directStatementIsNonThrowing(statement, input) ??
  compoundStatementIsNonThrowing(statement, input);

const blockIsNonThrowing = (block: ESTree.BlockStatement, input: CatchExecutionInput): boolean =>
  block.body.every((statement) => statementIsNonThrowing(statement, input));

export const canonicalValueCatchExecution = (
  input: CatchExecutionInput,
): CanonicalValueGuardExecution => {
  const statement = input.guard.node.parent;
  if (statement.type !== "TryStatement" || statement.handler !== input.guard.node) {
    return { definite: false, executes: true };
  }
  return blockIsNonThrowing(statement.block, input)
    ? { definite: true, executes: false }
    : { definite: false, executes: true };
};
