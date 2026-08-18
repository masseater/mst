import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_MAX_LINES = 500;

const DEFAULT_MAX_SPEC_LINES = 1500;

const optionObjectFrom = (ruleOptions: Readonly<Options>): Readonly<Record<string, unknown>> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return {};
  return first;
};

const budgetFrom = (ruleOptions: Readonly<Options>, filename: string): number => {
  const configured = optionObjectFrom(ruleOptions);
  const spec = isSpecFile(filename, specFileSuffixesFrom(ruleOptions));
  const fallback = spec ? DEFAULT_MAX_SPEC_LINES : DEFAULT_MAX_LINES;
  const budgetProperty = spec ? "maxSpecLines" : "maxLines";
  const written = configured[budgetProperty];
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
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
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
  create(inspection) {
    const maxLines = budgetFrom(inspection.options, inspection.filename);
    return {
      Program(node: ESTree.Program) {
        const codeLines = codeLineCountOf(inspection.sourceCode.ast.tokens);
        if (codeLines <= maxLines) return;
        inspection.report({
          node,
          messageId: "oversizedFile",
          data: { codeLines, maxLines },
        });
      },
    };
  },
});
