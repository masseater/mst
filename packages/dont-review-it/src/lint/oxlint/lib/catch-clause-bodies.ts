import type { ESTree } from "@oxlint/plugins";

const statementCarriesNoWork = (statement: ESTree.Statement): boolean => {
  if (statement.type === "EmptyStatement") return true;
  return statement.type === "BlockStatement" && statement.body.every(statementCarriesNoWork);
};

export const bodyCarriesNoWork = (clause: ESTree.CatchClause): boolean =>
  clause.body.body.every(statementCarriesNoWork);
