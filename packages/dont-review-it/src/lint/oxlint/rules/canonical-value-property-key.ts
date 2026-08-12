import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuePropertyKey } from "./canonical-value-binding-types.ts";

const literalPropertyKey = (key: ESTree.Node): string | null => {
  if (key.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")) {
    return String(key.value);
  }
  if (key.type === "TemplateLiteral" && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? key.quasis[0]?.value.raw ?? "";
  }
  return null;
};

export const canonicalValuePropertyKeyOf = (
  key: ESTree.Node,
  computed: boolean,
): CanonicalValuePropertyKey => {
  if (!computed && key.type === "Identifier") return { kind: "static", value: key.name };
  if (key.type === "PrivateIdentifier") return { kind: "static", value: `#${key.name}` };
  const literalKey = literalPropertyKey(key);
  return literalKey === null
    ? { kind: "computed", expression: key }
    : { kind: "static", value: literalKey };
};
