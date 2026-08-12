import type { Context, Scope, Variable } from "@oxlint/plugins";

export type ScopeLookup = Context["sourceCode"]["getScope"];

const bindingInScope = (scope: Scope | null, name: string): Variable | null => {
  if (scope === null) return null;
  return scope.set.get(name) ?? bindingInScope(scope.upper, name);
};

export { bindingInScope };
