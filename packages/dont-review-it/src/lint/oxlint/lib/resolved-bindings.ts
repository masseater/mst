import type { ESTree, Scope, Variable } from "@oxlint/plugins";

export type ScopeLookup = (node: ESTree.Node) => Scope;

export type BindingResolution = {
  readonly scopeAt: ScopeLookup;
  readonly seenBindings: ReadonlySet<Variable>;
};

export const resolveBinding = (scope: Scope | null, spelled: string): Variable | null => {
  if (scope === null) return null;
  return scope.set.get(spelled) ?? resolveBinding(scope.upper, spelled);
};
