import * as ts from "typescript-6";

import {
  canonicalOwnerStatementIsDefinitelyNonThrowing,
  canonicalOwnerStaticBoolean,
  canonicalOwnerStaticPrimitive,
} from "./canonical-owner-nonthrow.ts";
import { unwrapCanonicalOwnerExpression } from "./canonical-owner-state.ts";

const tryStatementIsAbrupt = (statement: ts.TryStatement): boolean => {
  if (
    statement.finallyBlock !== undefined &&
    statementSequenceIsAbrupt(statement.finallyBlock.statements)
  ) {
    return true;
  }
  if (!statementSequenceIsAbrupt(statement.tryBlock.statements)) return false;
  return (
    statement.catchClause === undefined ||
    statementSequenceIsAbrupt(statement.catchClause.block.statements)
  );
};

const statementIsAbrupt = (statement: ts.Statement): boolean => {
  if (
    ts.isReturnStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isBreakStatement(statement) ||
    ts.isContinueStatement(statement)
  ) {
    return true;
  }
  if (ts.isBlock(statement)) return statementSequenceIsAbrupt(statement.statements);
  if (ts.isIfStatement(statement)) {
    return (
      statement.elseStatement !== undefined &&
      statementIsAbrupt(statement.thenStatement) &&
      statementIsAbrupt(statement.elseStatement)
    );
  }
  return ts.isTryStatement(statement) ? tryStatementIsAbrupt(statement) : false;
};

const statementSequenceIsAbrupt = (statements: readonly ts.Statement[]): boolean =>
  statements.some(statementIsAbrupt);

const precedingStatementIsAbrupt = (
  statements: readonly ts.Statement[],
  child: ts.Node,
): boolean => {
  const index = statements.findIndex((statement) => statement === child);
  return index >= 0 && statementSequenceIsAbrupt(statements.slice(0, index));
};

const switchClauseIsReachable = (clause: ts.CaseOrDefaultClause): boolean => {
  const switchStatement = clause.parent.parent;
  if (!ts.isSwitchStatement(switchStatement)) return true;
  const discriminant = canonicalOwnerStaticPrimitive(switchStatement.expression);
  if (discriminant === undefined) return true;
  const clauses = switchStatement.caseBlock.clauses;
  const matchingIndex = clauses.findIndex(
    (candidate) =>
      ts.isCaseClause(candidate) &&
      canonicalOwnerStaticPrimitive(candidate.expression) === discriminant,
  );
  const defaultIndex = clauses.findIndex(ts.isDefaultClause);
  const entryIndex = matchingIndex === -1 ? defaultIndex : matchingIndex;
  const clauseIndex = clauses.indexOf(clause);
  return (
    entryIndex !== -1 &&
    clauseIndex >= entryIndex &&
    !clauses
      .slice(entryIndex, clauseIndex)
      .some((preceding) => statementSequenceIsAbrupt(preceding.statements))
  );
};

const ifChildIsReachable = (child: ts.Node, parent: ts.Node): boolean => {
  if (!ts.isIfStatement(parent)) return true;
  const condition = canonicalOwnerStaticBoolean(parent.expression);
  if (child === parent.thenStatement) return condition !== false;
  return child !== parent.elseStatement || condition !== true;
};

const conditionalChildIsReachable = (child: ts.Node, parent: ts.Node): boolean => {
  if (!ts.isConditionalExpression(parent)) return true;
  const condition = canonicalOwnerStaticBoolean(parent.condition);
  if (child === parent.whenTrue) return condition !== false;
  return child !== parent.whenFalse || condition !== true;
};

const forOfExpressionIsEmpty = (expression: ts.Expression): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  return (
    (ts.isArrayLiteralExpression(current) && current.elements.length === 0) ||
    (ts.isStringLiteralLike(current) && current.text.length === 0)
  );
};

const loopChildIsReachable = (child: ts.Node, parent: ts.Node): boolean => {
  if (ts.isWhileStatement(parent) && child === parent.statement) {
    return canonicalOwnerStaticBoolean(parent.expression) !== false;
  }
  if (ts.isForStatement(parent) && parent.condition !== undefined) {
    if (child === parent.statement || child === parent.incrementor) {
      return canonicalOwnerStaticBoolean(parent.condition) !== false;
    }
  }
  if (ts.isForOfStatement(parent) && child === parent.statement) {
    return !forOfExpressionIsEmpty(parent.expression);
  }
  return true;
};

const logicalChildIsReachable = (child: ts.Node, parent: ts.Node): boolean => {
  if (!ts.isBinaryExpression(parent) || child !== parent.right) return true;
  const left = canonicalOwnerStaticBoolean(parent.left);
  if (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return left !== false;
  return parent.operatorToken.kind !== ts.SyntaxKind.BarBarToken || left !== true;
};

const catchChildIsReachable = (child: ts.Node, parent: ts.Node): boolean =>
  !ts.isTryStatement(parent) ||
  child !== parent.catchClause ||
  !parent.tryBlock.statements.every(canonicalOwnerStatementIsDefinitelyNonThrowing);

const statementChildIsReachable = (child: ts.Node, parent: ts.Node): boolean => {
  if (ts.isSourceFile(parent) || ts.isBlock(parent)) {
    return !precedingStatementIsAbrupt(parent.statements, child);
  }
  return ts.isCaseClause(parent) || ts.isDefaultClause(parent)
    ? !precedingStatementIsAbrupt(parent.statements, child)
    : true;
};

const clauseChildIsReachable = (_child: ts.Node, parent: ts.Node): boolean =>
  !ts.isCaseClause(parent) && !ts.isDefaultClause(parent) ? true : switchClauseIsReachable(parent);

const childIsReachable = (child: ts.Node, parent: ts.Node): boolean =>
  [
    ifChildIsReachable,
    conditionalChildIsReachable,
    loopChildIsReachable,
    logicalChildIsReachable,
    catchChildIsReachable,
    statementChildIsReachable,
    clauseChildIsReachable,
  ].every((predicate) => predicate(child, parent));

export const canonicalOwnerNodeIsSyntacticallyReachable = (node: ts.Node): boolean =>
  ts.isSourceFile(node) ||
  (childIsReachable(node, node.parent) && canonicalOwnerNodeIsSyntacticallyReachable(node.parent));
