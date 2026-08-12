import { canonicalValueStatementIsDirectlyAbrupt } from "./canonical-value-switch-execution.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const tryStatementIsAbrupt = (statement: ESTree.TryStatement): boolean => {
  if (statement.finalizer !== null && abruptSequence(statement.finalizer.body)) return true;
  if (!abruptSequence(statement.block.body)) return false;
  return statement.handler === null || abruptSequence(statement.handler.body.body);
};

const abruptStatement = (statement: ESTree.Statement): boolean => {
  if (canonicalValueStatementIsDirectlyAbrupt(statement)) return true;
  if (statement.type === "BlockStatement") return abruptSequence(statement.body);
  if (statement.type === "IfStatement") {
    return (
      statement.alternate !== null &&
      abruptStatement(statement.consequent) &&
      abruptStatement(statement.alternate)
    );
  }
  if (statement.type === "TryStatement") return tryStatementIsAbrupt(statement);
  return false;
};

const abruptSequence = (statements: readonly ESTree.Statement[]): boolean =>
  statements.some(abruptStatement);

const precedingStatementIsAbrupt = (
  statements: readonly ESTree.Statement[],
  child: ESTree.Node,
): boolean => {
  const index = statements.findIndex((statement) => statement === child);
  return index >= 0 && abruptSequence(statements.slice(0, index));
};

const edgeIsUnreachable = (child: ESTree.Node, parent: ESTree.Node): boolean => {
  if (parent.type === "Program" || parent.type === "BlockStatement") {
    return precedingStatementIsAbrupt(parent.body, child);
  }
  if (parent.type === "SwitchCase") {
    return precedingStatementIsAbrupt(parent.consequent, child);
  }
  return false;
};

export const canonicalValueNodeIsSyntacticallyReachable = (
  sourceCode: Pick<SourceCode, "getAncestors">,
  node: ESTree.Node,
): boolean => {
  const ancestors = sourceCode.getAncestors(node) as ESTree.Node[];
  return ancestors
    .toReversed()
    .reduce<{ readonly child: ESTree.Node; readonly reachable: boolean }>(
      (state, parent) => ({
        child: parent,
        reachable: state.reachable && !edgeIsUnreachable(state.child, parent),
      }),
      { child: node, reachable: true },
    ).reachable;
};
