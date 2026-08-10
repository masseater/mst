import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  createForbiddenNameMatcher,
  type ForbiddenNamePattern,
} from "../lib/forbidden-ambiguous-names.ts";

import type { ESTree } from "@oxlint/plugins";

const forbiddenPatternsOf = (options: readonly unknown[]): readonly ForbiddenNamePattern[] =>
  options.length === 0 ? [] : (options[0] as readonly ForbiddenNamePattern[]);

export const noAmbiguousVariableName = createDontReviewItRule({
  name: "no-ambiguous-variable-name--rename-to-concrete-noun",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a variable binding named by one of the configured ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment",
      relatedGuidelines: [],
    },
    messages: {
      ambiguousVariableName:
        "The name `{{name}}` must not be used as a variable binding name, because it names a container rather than the subject the binding holds, and a reader has to trace the assignment upstream to learn what that subject is. Rename it to a noun that names the value itself: the parsed config, the rendered fragment, the fetched record, the caught error. If one block offers several such nouns and none of them covers the binding, that block is doing several jobs; split it.",
    },
    schema: [
      {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string" },
          },
          required: ["pattern"],
          additionalProperties: false,
        },
      },
    ],
  },
  create(context) {
    const forbiddenPatterns = forbiddenPatternsOf(context.options);
    if (forbiddenPatterns.length === 0) return {};

    const isForbiddenName = createForbiddenNameMatcher(forbiddenPatterns);

    return {
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (node.id.type !== "Identifier") return;
        if (!isForbiddenName(node.id.name)) return;

        context.report({
          node: node.id,
          messageId: "ambiguousVariableName",
          data: { name: node.id.name },
        });
      },
    };
  },
});
