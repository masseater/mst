import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallableRuntime } from "./canonical-value-binding-call-types.ts";

export const canonicalValueIsGlobalPromise = (
  runtime: CanonicalValueCallableRuntime,
  expression: ESTree.Expression,
): boolean => {
  const current = unwrapExpression(expression);
  if (canonicalValueIsGlobalIdentifier(runtime, { expression: current, name: "Promise" })) {
    return true;
  }
  if (current.type !== "MemberExpression" || current.object.type === "Super") return false;
  return (
    canonicalValueStaticMemberName(current) === "Promise" &&
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: current.object,
      name: "globalThis",
    })
  );
};
