import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_MAX_LINES = 100;

const maxLinesFrom = (options: Readonly<Options>): number => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_MAX_LINES;
  }
  const { maxLines } = first;
  return typeof maxLines === "number" ? maxLines : DEFAULT_MAX_LINES;
};

export const forbidOversizedFile = createDontReviewItRule({
  name: "forbid-oversized-file--split-by-responsibility",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a file longer than the configured line budget, so a file is split while it still has one seam instead of after it has accumulated several responsibilities",
      relatedGuidelines: [],
    },
    messages: {
      oversizedFile:
        "A file must not grow past its line budget, because a file that long has already taken on more than one responsibility and every later split has to move code that other files import by then. This file is {{lineCount}} lines against a budget of {{maxLines}}. Name the responsibilities this file has taken on and move each one into its own file now, while nothing outside depends on where they sit.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxLines: { type: "integer", minimum: 1, default: DEFAULT_MAX_LINES },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const maxLines = maxLinesFrom(context.options);
    return {
      Program(node: ESTree.Program) {
        const lineCount = context.sourceCode.lines.length;
        if (lineCount <= maxLines) return;
        context.report({
          node,
          messageId: "oversizedFile",
          data: { lineCount, maxLines },
        });
      },
    };
  },
});
