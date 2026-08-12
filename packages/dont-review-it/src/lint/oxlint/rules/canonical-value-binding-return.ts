import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueExecutionIndex } from "./canonical-value-binding-execution.ts";
import type {
  CanonicalValueFunctionExpression,
  CanonicalValueYieldResult,
} from "./canonical-value-binding-types.ts";

export type CanonicalValueBindingReturnIndex = {
  readonly functionReturnResults: (
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
  ) => readonly ESTree.Expression[];
  readonly functionYieldResults: (
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
  ) => readonly CanonicalValueYieldResult[];
  readonly memberReadResults: (node: ESTree.MemberExpression) => {
    readonly complete: boolean;
    readonly expressions: readonly ESTree.Expression[];
  } | null;
  readonly recordMemberGetter: (
    member: ESTree.MemberExpression,
    getters: readonly CanonicalValueFunctionExpression[],
  ) => void;
  readonly recordReturnStatement: (node: ESTree.ReturnStatement) => void;
  readonly recordYieldExpression: (node: ESTree.YieldExpression) => void;
};

const resultOwner = (
  executionIndex: CanonicalValueExecutionIndex,
  node: ESTree.Node,
): ESTree.ArrowFunctionExpression | ESTree.Function | null => {
  const owner = executionIndex.contextAt(node).node;
  if (
    owner.type === "ArrowFunctionExpression" ||
    owner.type === "FunctionDeclaration" ||
    owner.type === "FunctionExpression"
  ) {
    return owner;
  }
  return null;
};

export const createCanonicalValueBindingReturnIndex = (
  executionIndex: CanonicalValueExecutionIndex,
): CanonicalValueBindingReturnIndex => {
  const memberGetters = new WeakMap<
    ESTree.MemberExpression,
    readonly CanonicalValueFunctionExpression[]
  >();
  const returns = new WeakMap<ESTree.Node, readonly ESTree.Expression[]>();
  const yields = new WeakMap<ESTree.Node, readonly CanonicalValueYieldResult[]>();
  return {
    functionReturnResults: (node) => {
      if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
        return [node.body];
      }
      return returns.get(node) ?? [];
    },
    functionYieldResults: (node) => yields.get(node) ?? [],
    memberReadResults: (node) => {
      const getters = memberGetters.get(node);
      if (getters === undefined) return null;
      return {
        complete: getters.every((getter) => {
          const last = getter.body.body.at(-1);
          return last?.type === "ReturnStatement" && last.argument !== null;
        }),
        expressions: getters.flatMap((getter) => returns.get(getter) ?? []),
      };
    },
    recordMemberGetter: (member, getters) => {
      memberGetters.set(member, getters);
    },
    recordReturnStatement: (node) => {
      if (node.argument === null || !executionIndex.isReachable(node)) return;
      const owner = resultOwner(executionIndex, node);
      if (owner === null) return;
      returns.set(owner, [...(returns.get(owner) ?? []), node.argument]);
    },
    recordYieldExpression: (node) => {
      if (node.argument === null || !executionIndex.isReachable(node)) return;
      const owner = resultOwner(executionIndex, node);
      if (owner === null) return;
      yields.set(owner, [
        ...(yields.get(owner) ?? []),
        { delegate: node.delegate, expression: node.argument },
      ]);
    },
  };
};
