import type { ESTree } from "@oxlint/plugins";

export type ImportedBinding = {
  readonly directNames: Set<string>;
  readonly namespaceNames: Set<string>;
};

export const newBinding = (): ImportedBinding => ({
  directNames: new Set<string>(),
  namespaceNames: new Set<string>(),
});

export const importedNameOf = (specifier: ESTree.ImportSpecifier): string =>
  specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name;

export type ImportedTarget = {
  readonly exportedName: string;
  readonly binding: ImportedBinding;
};

export const collectBinding = (node: ESTree.ImportDeclaration, checked: ImportedTarget): void => {
  for (const specifier of node.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      checked.binding.namespaceNames.add(specifier.local.name);
      continue;
    }
    if (specifier.type !== "ImportSpecifier") continue;
    if (importedNameOf(specifier) !== checked.exportedName) continue;
    checked.binding.directNames.add(specifier.local.name);
  }
};

export const isReferenceTo = (expression: ESTree.Expression, checked: ImportedTarget): boolean => {
  if (expression.type === "Identifier") return checked.binding.directNames.has(expression.name);
  if (expression.type !== "MemberExpression" || expression.computed) return false;
  if (expression.object.type !== "Identifier" || expression.property.type !== "Identifier") {
    return false;
  }
  return (
    checked.binding.namespaceNames.has(expression.object.name) &&
    expression.property.name === checked.exportedName
  );
};
