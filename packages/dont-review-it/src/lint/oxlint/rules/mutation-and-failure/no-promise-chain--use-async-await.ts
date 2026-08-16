import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const CHAIN_MEMBER_NAMES: ReadonlySet<string> = new Set(["then", "catch", "finally"]);

const staticPropertyName = (property: ESTree.Expression): string | null => {
  if (property.type === "Literal") {
    return typeof property.value === "string" ? property.value : null;
  }
  if (property.type === "TemplateLiteral") {
    if (property.expressions.length !== 0) return null;
    return property.quasis.map((quasi) => quasi.value.cooked).join("");
  }
  return null;
};

const chainMemberName = (callee: ESTree.MemberExpression): string | null => {
  if (!callee.computed) {
    return callee.property.type === "Identifier" ? callee.property.name : null;
  }
  return staticPropertyName(callee.property);
};

export const noPromiseChain = createDontReviewItRule({
  name: "no-promise-chain--use-async-await",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling a member named then, catch or finally, so the continuation and the failure handling of an asynchronous call stay on the enclosing function's own control flow",
      relatedGuidelines: [],
    },
    messages: {
      promiseChainCall:
        "Calling a member named `{{method}}` is forbidden. Await the asynchronous value and let the following statements use it, and move the failure handling into the `catch` clause and the cleanup into the `finally` clause of a `try` statement that encloses that `await`.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        const { callee } = node;
        if (callee.type !== "MemberExpression") return;

        const method = chainMemberName(callee);
        if (method === null || !CHAIN_MEMBER_NAMES.has(method)) return;

        inspection.report({
          node: callee.property,
          messageId: "promiseChainCall",
          data: { method },
        });
      },
    };
  },
});
