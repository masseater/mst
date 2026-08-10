import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const isForStatementInitializer = (node: ESTree.VariableDeclaration): boolean =>
  node.parent.type === "ForStatement" && node.parent.init === node;

export const noMultiBindingDeclaration = createDontReviewItRule({
  name: "no-multi-binding-declaration--declare-one-binding-per-statement",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a declaration statement that introduces more than one binding, so every binding has a statement of its own to be read, moved and deleted at",
      relatedGuidelines: [],
    },
    messages: {
      multiBindingDeclaration:
        "A declaration statement must not introduce {{count}} bindings at once, because the bindings then share a line range: moving one drags the others, deleting one leaves a comma to repair, and a diff that touches one reads as if it touched all of them. Give each binding its own statement, repeating the declaration keyword.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (node.declarations.length < 2) return;
        if (isForStatementInitializer(node)) return;
        context.report({
          node,
          messageId: "multiBindingDeclaration",
          data: { count: String(node.declarations.length) },
        });
      },
    };
  },
});
