import { createDontReviewItRule } from "../../../create-rule.ts";
import { isJsdoc } from "../lib/jsdoc-comment.ts";

import type { Comment, ESTree } from "@oxlint/plugins";

const descriptionProse = (
  comment: Comment,
): readonly { readonly lineOffset: number; readonly text: string }[] => {
  const stripped = comment.value.split("\n").map((line, lineOffset) => ({
    lineOffset,
    text: line.replace(/^\s*\*?\s?/u, "").trim(),
  }));
  const firstTag = stripped.findIndex((line) => line.text.startsWith("@"));
  const beforeTags = firstTag === -1 ? stripped : stripped.slice(0, firstTag);
  return beforeTags.filter((line) => line.text !== "");
};

export const noDetachedRationale = createDontReviewItRule({
  name: "no-detached-rationale--comment-at-explained-line",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a JSDoc block to carry tag content only, so an explanation never drifts above a signature instead of sitting on the code it explains",
      relatedGuidelines: [],
    },
    messages: {
      jsdocDescriptionProse:
        "Free description prose must not sit above a signature instead of on the code it explains, because nothing ties it to the lines it describes once they change. Move contract prose under the JSDoc tag that owns it (`@param`, `@returns`, `@throws`, `@example`, `@see`, `@remarks`), and delete the rest.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          if (!isJsdoc(comment)) continue;

          const prose = descriptionProse(comment);
          if (prose.length === 0) continue;

          context.report({
            loc: {
              start: { line: comment.loc.start.line + prose[0].lineOffset, column: 0 },
              end: comment.loc.end,
            },
            messageId: "jsdocDescriptionProse",
          });
        }
      },
    };
  },
});
