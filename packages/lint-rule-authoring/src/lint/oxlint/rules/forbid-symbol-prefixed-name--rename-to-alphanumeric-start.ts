import { relative, sep } from "node:path";

import { createLintRuleAuthoringRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const isHiddenSegment = (segment: string): boolean => segment.startsWith(".");

const startsWithAlphanumeric = (segment: string): boolean => /^[a-zA-Z0-9]/u.test(segment);

const symbolPrefixedSegments = (repositoryRelativePath: string): readonly string[] =>
  repositoryRelativePath
    .split(sep)
    .filter(
      (segment) => segment !== "" && !isHiddenSegment(segment) && !startsWithAlphanumeric(segment),
    );

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
        "A directory or file name must not start with anything other than a letter or a digit, because a glob walk passes over such a name and whatever is placed under it stays unchecked with nothing reporting the gap. Rename `{{segment}}` so it starts with a letter or a digit.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        for (const segment of symbolPrefixedSegments(relative(context.cwd, context.filename))) {
          context.report({ node, messageId: "symbolPrefixedSegment", data: { segment } });
        }
      },
    };
  },
});
