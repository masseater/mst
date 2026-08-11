import type { ESTree } from "@oxlint/plugins";

export const NODE_TYPE_FIELD = "type";

export type AstFields = Readonly<Record<string, unknown>>;

export const isAstFields = (held: unknown): held is AstFields =>
  typeof held === "object" && held !== null && !Array.isArray(held);

export const ancestorsOf = (node: ESTree.Node): readonly ESTree.Node[] => {
  const { parent } = node;
  return parent === null ? [] : [...ancestorsOf(parent), parent];
};
