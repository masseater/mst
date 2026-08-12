import { createLintRuleAuthoringRule } from "../../../create-rule.ts";
import { firstToken } from "../../../first-token.ts";

import type { ESTree } from "@oxlint/plugins";

const BROAD_LINT_DIRECTIVES = new Map([
  ["eslint-disable", "eslint-disable-next-line"],
  ["eslint-disable-line", "eslint-disable-next-line"],
  ["oxlint-disable", "oxlint-disable-next-line"],
  ["oxlint-disable-line", "oxlint-disable-next-line"],
]);

export const noBroadLintDisable = createLintRuleAuthoringRule({
  name: "no-broad-lint-disable--use-next-line-with-reason",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it",
      relatedGuidelines: [],
    },
    messages: {
      broadLintDisable:
        "A `{{ directive }}` comment must not stay in the source. Replace it with `{{ nextLineDirective }}` on its own line directly above the single line that violates, name there the rule it suppresses, and state the grounds for the suppression after `--`.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          const directive = firstToken(comment.value);
          const nextLineDirective = BROAD_LINT_DIRECTIVES.get(directive);
          if (nextLineDirective === undefined) continue;
          inspection.report({
            loc: comment.loc,
            messageId: "broadLintDisable",
            data: { directive, nextLineDirective },
          });
        }
      },
    };
  },
});
