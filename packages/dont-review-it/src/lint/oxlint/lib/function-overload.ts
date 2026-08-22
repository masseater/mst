import type { ESTree } from "@oxlint/plugins";

const declarationContainer = (node: ESTree.Function): ESTree.Node => {
  const parent = node.parent;
  return parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration"
    ? parent.parent
    : parent;
};

export const hasFunctionOverload = (node: ESTree.Function): boolean => {
  if (node.id === null) return false;
  const container = declarationContainer(node);
  if (container.type !== "Program" && container.type !== "BlockStatement") return false;
  return container.body.some((statement) => {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    return declaration?.type === "TSDeclareFunction" && declaration.id?.name === node.id?.name;
  });
};
