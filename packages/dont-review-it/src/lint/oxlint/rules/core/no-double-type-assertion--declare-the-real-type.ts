import { createDontReviewItRule } from "../../../../create-rule.ts";
import { isTypeAssertion } from "../../lib/loose-type-claims.ts";

import type { ESTree } from "@oxlint/plugins";

export const noDoubleTypeAssertion = createDontReviewItRule({
  name: "no-double-type-assertion--declare-the-real-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking",
      relatedGuidelines: [],
    },
    messages: {
      stackedTypeAssertion:
        "A type assertion must not be applied to an expression that is already a type assertion. Declare the type the value really has: annotate the place the value comes from, narrow it with a guard that inspects the value, or parse it into the target type and let the parse fail on input that does not match.",
    },
    schema: [],
  },
  create(inspection) {
    const reportWhenStacked = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (!isTypeAssertion(node.expression)) return;
      inspection.report({ node, messageId: "stackedTypeAssertion" });
    };

    return {
      TSAsExpression: reportWhenStacked,
      TSTypeAssertion: reportWhenStacked,
    };
  },
});
