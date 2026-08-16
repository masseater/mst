import type { ESTree } from "@oxlint/plugins";

export type WidenedTypeNode = ESTree.TSAnyKeyword | ESTree.TSUnknownKeyword;

export const WIDENED_TYPE_NODES: ReadonlySet<string> = new Set([
  "TSAnyKeyword",
  "TSUnknownKeyword",
]);

export const isWidenedType = (node: ESTree.TSType): node is WidenedTypeNode =>
  WIDENED_TYPE_NODES.has(node.type);
