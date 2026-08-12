import type { ESTree } from "@oxlint/plugins";

export type ImportedBinding = {
  readonly directNames: Set<string>;
  readonly namespaceNames: Set<string>;
};

export type ImportedTarget = {
  readonly exportedName: string;
  readonly binding: ImportedBinding;
};

export const newBinding = (): ImportedBinding => ({
  directNames: new Set<string>(),
  namespaceNames: new Set<string>(),
});

export const importedNameOf = (specifier: ESTree.ImportSpecifier): string =>
  specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name;

export const collectBinding = (node: ESTree.ImportDeclaration, target: ImportedTarget): void => {
  for (const specifier of node.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      target.binding.namespaceNames.add(specifier.local.name);
      continue;
    }
    if (specifier.type !== "ImportSpecifier") continue;
    if (importedNameOf(specifier) !== target.exportedName) continue;
    target.binding.directNames.add(specifier.local.name);
  }
};

export const isCallOf = (callee: ESTree.Expression, target: ImportedTarget): boolean => {
  if (callee.type === "Identifier") return target.binding.directNames.has(callee.name);
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return false;
  return (
    target.binding.namespaceNames.has(callee.object.name) &&
    callee.property.name === target.exportedName
  );
};
