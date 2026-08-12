import type { Definition } from "@oxlint/plugins";

export const canonicalValueImportedDefinitionName = (definition: Definition): string | null => {
  if (definition.node.type !== "ImportSpecifier") return null;
  const imported = definition.node.imported;
  return imported.type === "Identifier"
    ? imported.name
    : typeof imported.value === "string"
      ? imported.value
      : null;
};
