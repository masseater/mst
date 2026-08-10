import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const CHAIN_MEMBER_NAMES: ReadonlySet<string> = new Set(["then", "catch", "finally"]);

const staticPropertyName = (property: ESTree.Expression): string | null => {
  if (property.type === "Literal") {
    return typeof property.value === "string" ? property.value : null;
  }
  if (property.type === "TemplateLiteral") {
    return property.expressions.length === 0 ? (property.quasis[0]?.value.cooked ?? null) : null;
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
        "Calling a member named `{{method}}` is forbidden, because the continuation and the failure handling of an asynchronous call then sit inside callback arguments instead of the enclosing function's own control flow, and a reader has to open every callback to learn what happens when the call fails. Await the asynchronous value and let the following statements use it, and move the failure handling into the `catch` clause and the cleanup into the `finally` clause of a `try` statement that encloses that `await`. This rule matches the property name `then`, `catch` or `finally` and never inspects the receiver, so a non-Promise interface that happens to expose one of those names is reported as well; how such an interface should be called instead is still undecided, so report the occurrence instead of working around the check.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        const { callee } = node;
        if (callee.type !== "MemberExpression") return;

        const method = chainMemberName(callee);
        if (method === null || !CHAIN_MEMBER_NAMES.has(method)) return;

        context.report({
          node: callee.property,
          messageId: "promiseChainCall",
          data: { method },
        });
      },
    };
  },
});
