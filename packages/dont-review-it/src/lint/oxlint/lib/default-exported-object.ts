import type { ESTree } from "@oxlint/plugins";

export const objectExpressionOf = (
  held: ESTree.ExportDefaultDeclaration["declaration"],
): ESTree.ObjectExpression | null => {
  if (held.type === "ObjectExpression") return held;
  if (held.type !== "CallExpression") return null;
  const [firstArgument] = held.arguments;
  if (firstArgument === undefined || firstArgument.type === "SpreadElement") return null;
  return objectExpressionOf(firstArgument);
};

export type ProgramStatements = {
  readonly body: readonly ESTree.Program["body"][number][];
};

export const defaultExportedObject = (
  program: ProgramStatements,
): ESTree.ObjectExpression | null => {
  const exported = program.body.findLast(
    (node): node is ESTree.ExportDefaultDeclaration => node.type === "ExportDefaultDeclaration",
  );
  return exported === undefined ? null : objectExpressionOf(exported.declaration);
};
