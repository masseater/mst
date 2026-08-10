import type { ESTree } from "@oxlint/plugins";

type DefaultExportedValue = ESTree.ExportDefaultDeclaration["declaration"];

const objectExpressionOf = (value: DefaultExportedValue): ESTree.ObjectExpression | null => {
  if (value.type === "ObjectExpression") return value;
  if (value.type !== "CallExpression") return null;
  const [firstArgument] = value.arguments;
  if (firstArgument === undefined || firstArgument.type === "SpreadElement") return null;
  return objectExpressionOf(firstArgument);
};

export const defaultExportedObject = (program: ESTree.Program): ESTree.ObjectExpression | null => {
  const exported = program.body.findLast(
    (node): node is ESTree.ExportDefaultDeclaration => node.type === "ExportDefaultDeclaration",
  );
  return exported === undefined ? null : objectExpressionOf(exported.declaration);
};
