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
        "A declaration statement must not introduce more than one binding, and this one introduces {{count}}. Give each binding its own statement, repeating the declaration keyword.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (node.declarations.length < 2) return;
        if (isForStatementInitializer(node)) return;
        inspection.report({
          node,
          messageId: "multiBindingDeclaration",
          data: { count: String(node.declarations.length) },
        });
      },
    };
  },
});
