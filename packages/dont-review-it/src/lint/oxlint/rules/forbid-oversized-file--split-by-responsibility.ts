import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_MAX_LINES = 400;

const maxLinesFrom = (options: Readonly<Options>): number => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_MAX_LINES;
  }
  const { maxLines } = first;
  return typeof maxLines === "number" ? maxLines : DEFAULT_MAX_LINES;
};

const codeLineCountOf = (tokens: readonly ESTree.Token[]): number =>
  new Set(tokens.flatMap((token) => range(token.loc.start.line, token.loc.end.line + 1))).size;

export const forbidOversizedFile = createDontReviewItRule({
  name: "forbid-oversized-file--split-by-responsibility",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a file carrying more code lines than the budget set for it, so a file is split while it still has one seam instead of after it has accumulated several responsibilities",
      relatedGuidelines: [],
    },
    messages: {
      oversizedFile:
        "A file must not carry more code lines than the budget set for it, because a file that long has already taken on more than one responsibility and every later split has to move code that other files import by then. This file carries {{codeLines}} code lines against a budget of {{maxLines}}. Name the responsibilities it has taken on and move each one into a file named after it. Do not split it by number (`subject-1.ts`, `subject-2.ts`): that leaves one responsibility spread across files whose names say nothing about what is in them.",
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
        const codeLines = codeLineCountOf(context.sourceCode.ast.tokens);
        if (codeLines <= maxLines) return;
        context.report({
          node,
          messageId: "oversizedFile",
          data: { codeLines, maxLines },
        });
      },
    };
  },
});
