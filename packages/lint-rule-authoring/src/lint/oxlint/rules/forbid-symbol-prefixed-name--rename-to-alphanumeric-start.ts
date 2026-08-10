import { createLintRuleAuthoringRule } from "../../../create-rule.ts";
import { symbolPrefixedSegmentsOf } from "../../../symbol-prefixed-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const allowedNamesFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const { allowedNames } = first;
  if (!Array.isArray(allowedNames)) return [];
  return allowedNames.filter((entry): entry is string => typeof entry === "string");
};

export const forbidSymbolPrefixedName = createLintRuleAuthoringRule({
  name: "forbid-symbol-prefixed-name--rename-to-alphanumeric-start",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it",
      relatedGuidelines: [],
    },
    messages: {
      symbolPrefixedSegment:
        "A directory or file name must not start with anything other than a letter or a digit, because a glob walk passes over such a name and whatever is placed under it stays unchecked with nothing reporting the gap. The name `{{segment}}`, on the path `{{path}}`, starts with something else. Rename that one name so it starts with a letter or a digit.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedNames: {
            type: "array",
            items: { type: "string", pattern: "^[^/]+$" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowedNames = allowedNamesFrom(context.options);

    return {
      Program(node: ESTree.Program) {
        const offending = symbolPrefixedSegmentsOf({
          location: { cwd: context.cwd, filename: context.filename },
          allowedNames,
        });

        for (const { segment, path } of offending) {
          context.report({
            node,
            messageId: "symbolPrefixedSegment",
            data: { segment, path },
          });
        }
      },
    };
  },
});
