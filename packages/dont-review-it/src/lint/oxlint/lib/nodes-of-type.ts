import { isAstFields, NODE_TYPE_FIELD } from "./ast-node.ts";

import type { ESTree } from "@oxlint/plugins";

type NodeOfType<T extends ESTree.Node["type"]> = ESTree.Node extends infer Held
  ? Held extends { type: infer Spelling }
    ? T extends Spelling
      ? Held
      : never
    : never
  : never;

const BACK_REFERENCE_FIELD = "parent";

const isNodeOfType = <T extends ESTree.Node["type"]>(
  held: unknown,
  type: T,
): held is NodeOfType<T> => isAstFields(held) && held[NODE_TYPE_FIELD] === type;

const nodesWithin = <T extends ESTree.Node["type"]>(
  held: unknown,
  type: T,
): readonly NodeOfType<T>[] => {
  if (Array.isArray(held)) return held.flatMap((listed) => nodesWithin(listed, type));
  if (!isAstFields(held)) return [];

  const nested = Object.entries(held)
    .filter(([field]) => field !== BACK_REFERENCE_FIELD)
    .flatMap(([, carried]) => nodesWithin(carried, type));
  return isNodeOfType(held, type) ? [held, ...nested] : nested;
};

export const nodesOfType = <T extends ESTree.Node["type"]>(
  root: ESTree.Node,
  type: T,
): readonly NodeOfType<T>[] => nodesWithin(root, type);
