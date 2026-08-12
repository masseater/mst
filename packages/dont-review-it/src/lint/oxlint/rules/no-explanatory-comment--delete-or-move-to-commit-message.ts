import { firstToken } from "@mst/lint-rule-authoring";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { MOCK_FACTORY_EXEMPTION_DIRECTIVE } from "../lib/directive-comments.ts";
import { isJsdoc } from "../lib/jsdoc-comment.ts";

import type { Comment, ESTree } from "@oxlint/plugins";

const LINT_DIRECTIVE = /^(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)$/u;

const COMPILER_DIRECTIVE_PREFIX = "@ts-";

const isMachineReadDirective = (comment: Comment): boolean => {
  const token = firstToken(comment.value);
  return (
    LINT_DIRECTIVE.test(token) ||
    token === MOCK_FACTORY_EXEMPTION_DIRECTIVE ||
    token.startsWith(COMPILER_DIRECTIVE_PREFIX)
  );
};

export const noExplanatoryComment = createDontReviewItRule({
  name: "no-explanatory-comment--delete-or-move-to-commit-message",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comments that explain the code, so reasoning lives in the commit message instead of drifting beside an implementation that moves on without it",
      relatedGuidelines: [],
    },
    messages: {
      explanatoryComment:
        "A comment that explains the code must not stay in the source. Delete it and put the reasoning in the body of the commit that makes the change.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          if (comment.type === "Shebang") continue;
          if (isJsdoc(comment)) continue;
          if (isMachineReadDirective(comment)) continue;
          context.report({ loc: comment.loc, messageId: "explanatoryComment" });
        }
      },
    };
  },
});
