import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { forbidOversizedFile } from "./forbid-oversized-file--split-by-responsibility.ts";

const sourceOfLines = (count: number): string =>
  Array.from({ length: count }, (_, index) => `const value${index} = ${index};`).join("\n");

describe("dont-review-it/forbid-oversized-file--split-by-responsibility", () => {
  testLintRule(forbidOversizedFile, {
    valid: [
      {
        name: "a file shorter than the default budget passes",
        code: sourceOfLines(99),
      },
      {
        name: "a file exactly at the budget is not over it",
        code: sourceOfLines(3),
        options: [{ maxLines: 3 }],
      },
      {
        name: "a raised budget lets through a file the default would report",
        code: sourceOfLines(150),
        options: [{ maxLines: 200 }],
      },
    ],
    invalid: [
      {
        name: "a file one line past the default budget is reported",
        code: sourceOfLines(101),
        errors: [{ messageId: "oversizedFile", data: { lineCount: 101, maxLines: 100 } }],
      },
      {
        name: "an options object without the key falls back to the default budget",
        code: sourceOfLines(101),
        options: [{}],
        errors: [{ messageId: "oversizedFile", data: { lineCount: 101, maxLines: 100 } }],
      },
      {
        name: "a lowered budget reports the whole program rather than a line inside it",
        code: sourceOfLines(4),
        options: [{ maxLines: 3 }],
        errors: [
          {
            messageId: "oversizedFile",
            data: { lineCount: 4, maxLines: 3 },
            line: 1,
            column: 0,
            endLine: 4,
            endColumn: 17,
          },
        ],
      },
      {
        name: "the file is reported once rather than once per line past the budget",
        code: sourceOfLines(5),
        options: [{ maxLines: 1 }],
        errors: [{ messageId: "oversizedFile", data: { lineCount: 5, maxLines: 1 } }],
      },
      {
        name: "a trailing newline counts as a line",
        code: `${sourceOfLines(3)}\n`,
        options: [{ maxLines: 3 }],
        errors: [{ messageId: "oversizedFile", data: { lineCount: 4, maxLines: 3 } }],
      },
    ],
  });

  test("the options schema declares the budget and refuses any other key", () => {
    expect(forbidOversizedFile.meta.schema).toStrictEqual([
      {
        type: "object",
        properties: { maxLines: { type: "integer", minimum: 1, default: 100 } },
        additionalProperties: false,
      },
    ]);
  });
});
