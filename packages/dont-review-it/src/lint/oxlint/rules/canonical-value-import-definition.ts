import type { Definition, ESTree } from "@oxlint/plugins";

const canonicalValueImportDeclarationOf = (
  definition: Definition,
): ESTree.ImportDeclaration | null => {
  const parent = definition.node.parent;
  return parent?.type === "ImportDeclaration" ? parent : null;
};

export { canonicalValueImportDeclarationOf };
