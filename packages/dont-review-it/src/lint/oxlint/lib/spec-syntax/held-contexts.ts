import type { ESTree } from "@oxlint/plugins";

export type HeldContext = {
  readonly name: string;
  readonly start: number;
  readonly end: number;
};

export type ContextReach = {
  readonly node: ESTree.Node;
  readonly name: string;
};

export const isHeldContextReach = (reach: ContextReach, held: readonly HeldContext[]): boolean =>
  held.some(
    (binding) =>
      binding.name === reach.name &&
      binding.start <= reach.node.start &&
      reach.node.end <= binding.end,
  );
