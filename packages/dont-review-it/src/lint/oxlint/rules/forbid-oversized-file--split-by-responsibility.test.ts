import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { forbidOversizedFile } from "./forbid-oversized-file--split-by-responsibility.ts";

const sourceOfLines = (count: number): string =>
  Array.from({ length: count }, (_, index) => `const line${index} = ${index};`).join("\n");

describe("dont-review-it/forbid-oversized-file--split-by-responsibility", () => {
  testLintRule(forbidOversizedFile, {
    valid: [
      {
        name: "a file shorter than the default budget passes",
        code: sourceOfLines(399),
      },
      {
        name: "a file exactly at the budget is not over it",
        code: sourceOfLines(3),
        options: [{ maxLines: 3 }],
      },
      {
        name: "a raised budget lets through a file the default would report",
        code: sourceOfLines(450),
        options: [{ maxLines: 500 }],
      },
      {
        name: "blank lines carry no code and are not counted",
        code: "const first = 1;\n\n\nconst second = 2;\n\n\nconst third = 3;",
        options: [{ maxLines: 3 }],
      },
      {
        name: "a line carrying only a line comment is not counted",
        code: "// what follows is the whole file\n// and this line too\nconst first = 1;\nconst second = 2;\nconst third = 3;",
        options: [{ maxLines: 3 }],
      },
      {
        name: "a block comment spanning several lines counts for none of them",
        code: "/* one\n   two\n   three */\nconst first = 1;",
        options: [{ maxLines: 1 }],
      },
      {
        name: "a trailing newline adds no code line",
        code: `${sourceOfLines(3)}\n`,
        options: [{ maxLines: 3 }],
      },
      {
        name: "a file holding nothing but comments has no code lines at all",
        code: "// one\n// two\n// three\n// four",
        options: [{ maxLines: 1 }],
      },
    ],
    invalid: [
      {
        name: "a file one line past the default budget is reported",
        code: sourceOfLines(401),
        errors: [{ messageId: "oversizedFile", data: { codeLines: 401, maxLines: 400 } }],
      },
      {
        name: "an options object without the key falls back to the default budget",
        code: sourceOfLines(401),
        options: [{}],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 401, maxLines: 400 } }],
      },
      {
        name: "a lowered budget reports the whole program rather than a line inside it",
        code: sourceOfLines(4),
        options: [{ maxLines: 3 }],
        errors: [
          {
            messageId: "oversizedFile",
            data: { codeLines: 4, maxLines: 3 },
            line: 1,
            column: 0,
            endLine: 4,
            endColumn: 16,
          },
        ],
      },
      {
        name: "the file is reported once rather than once per line past the budget",
        code: sourceOfLines(5),
        options: [{ maxLines: 1 }],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 5, maxLines: 1 } }],
      },
      {
        name: "a template literal spanning lines counts every line it spans, blank ones included",
        code: "const letters = `a\n\nb`;",
        options: [{ maxLines: 2 }],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 3, maxLines: 2 } }],
      },
      {
        name: "comments between code lines do not lower the count of the code lines themselves",
        code: "const first = 1;\n// a note about the next line\nconst second = 2;",
        options: [{ maxLines: 1 }],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 2, maxLines: 1 } }],
      },
    ],
  });

  test("the options schema declares the budget and refuses any other key", () => {
    expect(forbidOversizedFile.meta.schema).toStrictEqual([
      {
        type: "object",
        properties: { maxLines: { type: "integer", minimum: 1, default: 400 } },
        additionalProperties: false,
      },
    ]);
  });
});
