import { unwrapExpression } from "../canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

export type SpecFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

export type SpecStatement = ESTree.Directive | ESTree.Statement;

export const unwrapSubject = (node: ESTree.Expression): ESTree.Expression => {
  const written = unwrapExpression(node);
  if (written.type === "ChainExpression") return unwrapSubject(written.expression);
  if (written.type === "AwaitExpression") return unwrapSubject(written.argument);
  if (written.type === "ParenthesizedExpression") return unwrapSubject(written.expression);
  return written;
};

export const memberRootOf = (subject: ESTree.Expression): ESTree.IdentifierReference | null => {
  const written = unwrapSubject(subject);
  if (written.type === "Identifier") return written;
  if (written.type !== "MemberExpression") return null;
  return memberRootOf(written.object);
};

export const asSpecFunction = (node: ESTree.Expression): SpecFunction | null => {
  const written = unwrapSubject(node);
  if (written.type === "ArrowFunctionExpression") return written;
  if (written.type === "FunctionExpression") return written;
  return null;
};

const carriedBodyOf = (statement: SpecStatement): readonly SpecStatement[] => {
  if (
    statement.type === "ForStatement" ||
    statement.type === "ForInStatement" ||
    statement.type === "ForOfStatement" ||
    statement.type === "WhileStatement" ||
    statement.type === "DoWhileStatement" ||
    statement.type === "LabeledStatement"
  ) {
    return [statement.body];
  }
  return [];
};

const nestedStatements = (statement: SpecStatement): readonly SpecStatement[] => {
  if (statement.type === "BlockStatement") return statement.body;
  if (statement.type === "IfStatement") {
    return statement.alternate === null
      ? [statement.consequent]
      : [statement.consequent, statement.alternate];
  }
  if (statement.type === "TryStatement") {
    return [
      statement.block,
      ...(statement.handler === null ? [] : [statement.handler.body]),
      ...(statement.finalizer === null ? [] : [statement.finalizer]),
    ];
  }
  if (statement.type === "SwitchStatement") {
    return statement.cases.flatMap((branch) => branch.consequent);
  }
  return carriedBodyOf(statement);
};

const ownStatementsOf = (body: ESTree.FunctionBody): readonly SpecStatement[] => {
  const reached = (statements: readonly SpecStatement[]): readonly SpecStatement[] =>
    statements.flatMap((statement) => [statement, ...reached(nestedStatements(statement))]);
  return reached(body.body);
};

export const blockBodyOf = (fn: SpecFunction): ESTree.FunctionBody | null =>
  fn.body?.type !== "BlockStatement" ? null : fn.body;

export const returnedExpressionsOf = (fn: SpecFunction): readonly ESTree.Expression[] => {
  if (fn.body === null) return [];
  if (fn.body.type !== "BlockStatement") return [fn.body];
  return ownStatementsOf(fn.body).flatMap((statement) =>
    statement.type === "ReturnStatement" && statement.argument !== null ? [statement.argument] : [],
  );
};

export const argumentsPassedTo = (
  fn: SpecFunction,
  calleeName: string,
): readonly ESTree.Expression[] => {
  const body = blockBodyOf(fn);
  if (body === null) return [];
  return ownStatementsOf(body)
    .flatMap((statement) =>
      statement.type === "ExpressionStatement" ? [statement.expression] : [],
    )
    .map((expression) => unwrapSubject(expression))
    .flatMap((expression) => (expression.type === "CallExpression" ? [expression] : []))
    .filter((call) => call.callee.type === "Identifier" && call.callee.name === calleeName)
    .flatMap((call) => {
      const [handed] = call.arguments;
      return handed === undefined || handed.type === "SpreadElement" ? [] : [handed];
    });
};

export const localConstInitializer = (
  body: ESTree.FunctionBody,
  name: string,
): ESTree.Expression | null => {
  const [onlyBinding, ...rivalBindings] = body.body
    .flatMap((statement) => (statement.type === "VariableDeclaration" ? [statement] : []))
    .filter((declaration) => declaration.kind === "const")
    .flatMap((declaration) => declaration.declarations)
    .filter((declarator) => declarator.id.type === "Identifier" && declarator.id.name === name);
  return onlyBinding === undefined || rivalBindings.length !== 0 ? null : onlyBinding.init;
};
