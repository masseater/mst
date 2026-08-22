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
  nodeType: T,
): held is NodeOfType<T> => isAstFields(held) && held[NODE_TYPE_FIELD] === nodeType;

type TypedNodeVisit<T extends ESTree.Node["type"]> = {
  readonly node: NodeOfType<T>;
  readonly ancestors: readonly ESTree.Node[];
};

const isNode = (held: unknown): held is ESTree.Node =>
  isAstFields(held) && typeof held[NODE_TYPE_FIELD] === "string";

const visitsWithin = <T extends ESTree.Node["type"]>(
  held: unknown,
  walk: { readonly nodeType: T; readonly ancestors: readonly ESTree.Node[] },
): readonly TypedNodeVisit<T>[] => {
  if (Array.isArray(held)) return held.flatMap((listed) => visitsWithin(listed, walk));
  if (!isAstFields(held)) return [];

  const nested = Object.entries(held)
    .filter(([field]) => field !== BACK_REFERENCE_FIELD)
    .flatMap(([, carried]) =>
      visitsWithin(carried, {
        nodeType: walk.nodeType,
        ancestors: isNode(held) ? [...walk.ancestors, held] : walk.ancestors,
      }),
    );
  return isNodeOfType(held, walk.nodeType)
    ? [{ node: held, ancestors: walk.ancestors }, ...nested]
    : nested;
};

export const nodeVisitsOfType = <T extends ESTree.Node["type"]>(
  root: ESTree.Node,
  nodeType: T,
): readonly TypedNodeVisit<T>[] => visitsWithin(root, { nodeType, ancestors: [] });

export const nodesOfType = <T extends ESTree.Node["type"]>(
  root: ESTree.Node,
  nodeType: T,
): readonly NodeOfType<T>[] => nodeVisitsOfType(root, nodeType).map((visit) => visit.node);
