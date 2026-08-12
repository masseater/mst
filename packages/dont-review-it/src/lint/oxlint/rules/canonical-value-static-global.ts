import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const isGlobalIdentifier = (
  bindingIndex: CanonicalValueBindingIndex,
  input: { readonly expression: ESTree.Expression; readonly name: string },
): boolean => {
  if (input.expression.type !== "Identifier" || input.expression.name !== input.name) return false;
  const binding = bindingIndex.resolveIdentifier(input.expression);
  return binding === null || bindingIndex.definitionsOf(binding).length === 0;
};

export const canonicalValueStaticGlobalPropertyPath = (
  bindingIndex: CanonicalValueBindingIndex,
  input: { readonly name: string; readonly origin: CanonicalValueExpressionOrigin },
): readonly string[] | null => {
  const path = canonicalValueInvocationPropertyPath(input.origin);
  if (path === null) return null;
  if (
    isGlobalIdentifier(bindingIndex, {
      expression: input.origin.expression,
      name: input.name,
    })
  ) {
    return path;
  }
  return isGlobalIdentifier(bindingIndex, {
    expression: input.origin.expression,
    name: "globalThis",
  }) && path[0] === input.name
    ? path.slice(1)
    : null;
};
