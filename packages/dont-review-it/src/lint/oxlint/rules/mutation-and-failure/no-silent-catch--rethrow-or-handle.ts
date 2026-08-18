import { createDontReviewItRule } from "../../../../create-rule.ts";
import { bodyCarriesNoWork } from "../../lib/catch-clause-bodies.ts";

import type { ESTree } from "@oxlint/plugins";

const decidingChildOf = (parent: ESTree.Node): ESTree.Node | null => {
  switch (parent.type) {
    case "ConditionalExpression":
    case "DoWhileStatement":
    case "ForStatement":
    case "IfStatement":
    case "WhileStatement":
      return parent.test;
    case "SwitchStatement":
      return parent.discriminant;
    default:
      return null;
  }
};

const carriesFailure = (node: ESTree.Node): boolean => {
  const parent = node.parent as ESTree.Node;
  if (parent.type === "CatchClause") return true;
  if (decidingChildOf(parent) === node) return false;
  return carriesFailure(parent);
};

export const noSilentCatch = createDontReviewItRule({
  name: "no-silent-catch--rethrow-or-handle",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a catch clause whose body never carries the failure it bound out of the clause, so a failure that was caught reaches something able to act on it instead of ending where it was caught",
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
    },
    messages: {
      silentCatch:
        "A catch clause must not end without carrying the failure it bound out of the clause. Choose an ending that takes the failure with it: rethrow it, throw a failure that names this layer's part in it with the original passed as `cause`, hand it to the call that acts on it, or return a value that holds it.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      CatchClause(node: ESTree.CatchClause) {
        if (node.param === null) return;
        if (bodyCarriesNoWork(node)) return;

        const caught = inspection.sourceCode.getScope(node);
        const carried = caught.variables.some((variable) =>
          variable.references.some(
            (reference) => reference.isRead() && carriesFailure(reference.identifier),
          ),
        );
        if (carried) return;

        inspection.report({ node, messageId: "silentCatch" });
      },
    };
  },
});
