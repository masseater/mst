import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_MAX_LINES = 500;

const DEFAULT_MAX_SPEC_LINES = 1500;

const optionObjectFrom = (options: Readonly<Options>): Readonly<Record<string, unknown>> => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return {};
  return first;
};

const budgetFrom = (options: Readonly<Options>, filename: string): number => {
  const configured = optionObjectFrom(options);
  const spec = isSpecFile(filename, specFileSuffixesFrom(options));
  const key = spec ? "maxSpecLines" : "maxLines";
  const fallback = spec ? DEFAULT_MAX_SPEC_LINES : DEFAULT_MAX_LINES;
  const written = configured[key];
  return typeof written === "number" ? written : fallback;
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
        "A file must not carry more code lines than the budget set for it. This file carries {{codeLines}} code lines against a budget of {{maxLines}}. Name the responsibilities it has taken on and move each one into a file named after it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxLines: { type: "integer", minimum: 1 },
          maxSpecLines: { type: "integer", minimum: 1 },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const maxLines = budgetFrom(context.options, context.filename);
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
