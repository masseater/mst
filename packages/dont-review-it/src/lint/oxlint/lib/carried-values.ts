import { TYPE_ONLY_KIND } from "./setup-modules/coupling-edges.ts";

import type { ESTree } from "@oxlint/plugins";

export const reExportCarriesValues = (
  node: ESTree.ExportNamedDeclaration | ESTree.ExportAllDeclaration,
): boolean => {
  if (node.exportKind === TYPE_ONLY_KIND) return false;
  if (node.type === "ExportAllDeclaration") return true;
  return node.specifiers.some((specifier) => specifier.exportKind !== TYPE_ONLY_KIND);
};

export const importCarriesValues = (node: ESTree.ImportDeclaration): boolean => {
  if (node.importKind === TYPE_ONLY_KIND) return false;
  if (node.specifiers.length === 0) return true;
  return node.specifiers.some(
    (specifier) => specifier.type !== "ImportSpecifier" || specifier.importKind !== TYPE_ONLY_KIND,
  );
};
