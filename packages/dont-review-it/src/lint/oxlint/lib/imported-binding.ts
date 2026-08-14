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
  if (node.importKind === "type") return;
  for (const specifier of node.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      target.binding.namespaceNames.add(specifier.local.name);
      continue;
    }
    if (specifier.type !== "ImportSpecifier") continue;
    if (specifier.importKind === "type") continue;
    if (importedNameOf(specifier) !== target.exportedName) continue;
    target.binding.directNames.add(specifier.local.name);
  }
};

export const isReferenceOf = (reference: ESTree.Expression, target: ImportedTarget): boolean => {
  if (reference.type === "Identifier") return target.binding.directNames.has(reference.name);
  if (reference.type !== "MemberExpression" || reference.computed) return false;
  if (reference.object.type !== "Identifier" || reference.property.type !== "Identifier") {
    return false;
  }
  return (
    target.binding.namespaceNames.has(reference.object.name) &&
    reference.property.name === target.exportedName
  );
};

export const isCallOf = (callee: ESTree.Expression, target: ImportedTarget): boolean =>
  isReferenceOf(callee, target);
