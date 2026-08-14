import type { ESTree, SourceCode } from "@oxlint/plugins";

export type SourceNode = {
  readonly ancestors: readonly ESTree.Node[];
  readonly node: ESTree.Node;
};

const isNode = (candidate: unknown): candidate is ESTree.Node =>
  typeof candidate === "object" &&
  candidate !== null &&
  typeof Reflect.get(candidate, "type") === "string";

type SourceTree = Pick<SourceCode, "ast" | "visitorKeys">;

const childNodes = (sourceCode: SourceTree, node: ESTree.Node): readonly ESTree.Node[] =>
  (sourceCode.visitorKeys[node.type] ?? []).flatMap((visitorKey) => {
    const child: unknown = Reflect.get(node, visitorKey);
    return (Array.isArray(child) ? child : [child]).filter(isNode);
  });

const nodesUnder = (sourceCode: SourceTree, input: SourceNode): readonly SourceNode[] => [
  input,
  ...childNodes(sourceCode, input.node).flatMap((child) =>
    nodesUnder(sourceCode, { ancestors: [...input.ancestors, input.node], node: child }),
  ),
];

export const sourceNodes = (sourceCode: SourceTree): readonly SourceNode[] =>
  nodesUnder(sourceCode, { ancestors: [], node: sourceCode.ast });
