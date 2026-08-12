import * as ts from "typescript-6";

const staticBoolean = (expression: ts.Expression): boolean | null => {
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return staticBoolean(expression.expression);
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = staticBoolean(expression.operand);
    return operand === null ? null : !operand;
  }
  return null;
};

const unknownIfFlow = (
  statement: ts.IfStatement,
): {
  readonly continues: boolean;
  readonly expressions: readonly ts.Expression[];
} => {
  const thenFlow = statementFlow(statement.thenStatement);
  const elseFlow =
    statement.elseStatement === undefined
      ? { continues: true, expressions: [] }
      : statementFlow(statement.elseStatement);
  return {
    continues: thenFlow.continues || elseFlow.continues,
    expressions: [...thenFlow.expressions, ...elseFlow.expressions],
  };
};

const statementFlow = (
  statement: ts.Statement,
): {
  readonly continues: boolean;
  readonly expressions: readonly ts.Expression[];
} => {
  if (ts.isReturnStatement(statement)) {
    return {
      continues: false,
      expressions: statement.expression === undefined ? [] : [statement.expression],
    };
  }
  if (ts.isBlock(statement)) return statementsFlow(statement.statements);
  if (!ts.isIfStatement(statement)) return { continues: true, expressions: [] };
  const condition = staticBoolean(statement.expression);
  if (condition === true) return statementFlow(statement.thenStatement);
  if (condition === false) {
    return statement.elseStatement === undefined
      ? { continues: true, expressions: [] }
      : statementFlow(statement.elseStatement);
  }
  return unknownIfFlow(statement);
};

const statementsFlow = (
  statements: ts.NodeArray<ts.Statement>,
): {
  readonly continues: boolean;
  readonly expressions: readonly ts.Expression[];
} =>
  statements.reduce(
    (accumulated, statement) => {
      if (!accumulated.continues) return accumulated;
      const flow = statementFlow(statement);
      return {
        continues: flow.continues,
        expressions: [...accumulated.expressions, ...flow.expressions],
      };
    },
    { continues: true, expressions: [] } as {
      readonly continues: boolean;
      readonly expressions: readonly ts.Expression[];
    },
  );

export const viteConfigReturnedExpressions = (body: ts.ConciseBody): readonly ts.Expression[] =>
  ts.isBlock(body) ? statementsFlow(body.statements).expressions : [body];
