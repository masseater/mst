import { firstToken } from "@mst/lint-rule-authoring";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { suppressionDirectiveOf } from "../lib/lint-suppression/suppression-directives.ts";

import type { Comment, ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../lib/rule-message.ts";

const RANGE_END_SPELLINGS: ReadonlySet<string> = new Set(["eslint-enable", "oxlint-enable"]);

const EVERY_RULE_REACHING_HERE = "every rule this file is checked by";

const messageOf = (comment: Comment): RuleMessage | null => {
  const closing = firstToken(comment.value);
  if (RANGE_END_SPELLINGS.has(closing)) {
    return { messageId: "suppressionRangeEnd", data: { spelling: closing } };
  }

  const directive = suppressionDirectiveOf(comment);
  if (directive === null) return null;

  const spelling = { spelling: directive.spelling };
  if (directive.ruleNames.length === 0) {
    return {
      messageId: "blanketSuppression",
      data: { ...spelling, silenced: EVERY_RULE_REACHING_HERE },
    };
  }
  return {
    messageId: "namedSuppression",
    data: {
      ...spelling,
      silenced: directive.ruleNames.map((ruleName) => `\`${ruleName}\``).join(", "),
    },
  };
};

export const noLintSuppressionInSpec = createDontReviewItRule({
  name: "no-lint-suppression-in-spec--fix-the-violation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a lint suppression comment in the files these rules run on, so a report ends in a repair to the code or a repair to the rule and never in a comment that takes the report away",
      relatedGuidelines: [],
    },
    messages: {
      namedSuppression:
        "A `{{spelling}}` comment must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code that report stands on, or narrow what that rule detects. Nothing else settles a report.",
      blanketSuppression:
        "A `{{spelling}}` comment naming no rule must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code those reports stand on, or narrow what those rules detect. Nothing else settles a report.",
      suppressionRangeEnd:
        "A `{{spelling}}` comment must not stay in this file. It closes the range a suppression comment opens. Delete both ends of that range, then rewrite the code the reopened reports stand on, or narrow what those rules detect. Nothing else settles a report.",
    },
    schema: [],
    fixable: "code",
  },
  create(inspection) {
    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          const complaint = messageOf(comment);
          if (complaint === null) continue;
          inspection.report({
            loc: comment.loc,
            ...complaint,
            fix: (fixer) => fixer.removeRange([comment.start, comment.end]),
          });
        }
      },
    };
  },
});
