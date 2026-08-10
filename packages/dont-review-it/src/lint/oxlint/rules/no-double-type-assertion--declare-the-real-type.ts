import { createDontReviewItRule } from "../../../create-rule.ts";
import { withoutParentheses } from "../lib/parenthesized-expression.ts";

import type { ESTree } from "@oxlint/plugins";

const isAssertion = (expression: ESTree.Expression): boolean =>
  expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion";

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
        "A type assertion must not be applied to an expression that is already a type assertion, because one assertion only holds where the two types overlap and the checker rejects the pairs that do not, while a second assertion stacked on a first one that widens the value removes that check completely and lets any type be claimed for any value. Nothing fails while the code is written and the wrong shape arrives while it runs. Declare the type the value really has instead: annotate the place the value comes from, narrow it with a guard that inspects the value, or parse it into the target type and let the parse fail when the input does not match. For a value that enters from outside the program, give the boundary the type `unknown` and narrow from there in one checked step.",
    },
    schema: [],
  },
  create(context) {
    const reportWhenStacked = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (!isAssertion(withoutParentheses(node.expression))) return;
      context.report({ node, messageId: "stackedTypeAssertion" });
    };

    return {
      TSAsExpression: reportWhenStacked,
      TSTypeAssertion: reportWhenStacked,
    };
  },
});
