import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

export const canonicalValueIsGlobalIdentifier = (
  runtime: {
    readonly resolveIdentifier: (identifier: ESTree.IdentifierReference) => Variable | null;
  },
  input: { readonly expression: ESTree.Expression; readonly name: string },
): boolean => {
  if (input.expression.type !== "Identifier" || input.expression.name !== input.name) return false;
  const binding = runtime.resolveIdentifier(input.expression);
  return binding === null || binding.defs.length === 0;
};

export const canonicalValueIsGlobalMember = (
  runtime: {
    readonly resolveIdentifier: (identifier: ESTree.IdentifierReference) => Variable | null;
  },
  input: {
    readonly member: ESTree.MemberExpression;
    readonly objectName: string;
  },
): boolean => {
  if (input.member.object.type === "Super") return false;
  if (
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: input.member.object,
      name: input.objectName,
    })
  ) {
    return true;
  }
  const object = unwrapExpression(input.member.object);
  return (
    object.type === "MemberExpression" &&
    object.object.type !== "Super" &&
    canonicalValueStaticMemberName(object) === input.objectName &&
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: object.object,
      name: "globalThis",
    })
  );
};
