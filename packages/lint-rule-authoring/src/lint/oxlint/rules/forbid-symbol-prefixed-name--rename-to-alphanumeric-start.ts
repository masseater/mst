import { createLintRuleAuthoringRule } from "../../../create-rule.ts";
import { symbolPrefixedSegmentsOf } from "../../../symbol-prefixed-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const allowedNamesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const { allowedNames } = first;
  if (!Array.isArray(allowedNames)) return [];
  return allowedNames.filter(
    (allowedName): allowedName is string => typeof allowedName === "string",
  );
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
        "A directory or file name must not start with anything other than a letter or a digit. The name `{{segment}}`, on the path `{{path}}`, starts with something else. Rename that one name to start with a letter or a digit.",
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
  create(inspection) {
    const allowedNames = allowedNamesFrom(inspection.options);

    return {
      Program(node: ESTree.Program) {
        const offending = symbolPrefixedSegmentsOf({
          location: { cwd: inspection.cwd, filename: inspection.filename },
          allowedNames,
        });

        for (const [segment, path] of offending) {
          inspection.report({
            node,
            messageId: "symbolPrefixedSegment",
            data: { segment, path },
          });
        }
      },
    };
  },
});
