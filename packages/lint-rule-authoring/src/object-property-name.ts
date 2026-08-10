import type { ESTree } from "@oxlint/plugins";

export const propertyNameOf = (property: ESTree.ObjectProperty): string | null => {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
};
