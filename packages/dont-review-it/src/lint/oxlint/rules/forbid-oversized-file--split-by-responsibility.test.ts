import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, it } from "vite-plus/test";

import { forbidOversizedFile } from "./forbid-oversized-file--split-by-responsibility.ts";

const numberedLines = Array.from({ length: 1600 }, (_, index) => `const line${index} = ${index};`);

const sourceOfThreeLines = numberedLines.slice(0, 3).join("\n");
const sourceOfFourLines = numberedLines.slice(0, 4).join("\n");
const sourceOfFiveLines = numberedLines.slice(0, 5).join("\n");
const sourceOf399Lines = numberedLines.slice(0, 399).join("\n");
const sourceOf450Lines = numberedLines.slice(0, 450).join("\n");
const sourceOf501Lines = numberedLines.slice(0, 501).join("\n");
const sourceOf1499Lines = numberedLines.slice(0, 1499).join("\n");
const sourceOf1501Lines = numberedLines.slice(0, 1501).join("\n");

const optionsSchema = forbidOversizedFile.meta.schema;

describe("dont-review-it/forbid-oversized-file--split-by-responsibility", () => {
  testLintRule(forbidOversizedFile, {
    valid: [
      {
        name: "a file shorter than the default budget passes",
        code: sourceOf399Lines,
      },
      {
        name: "a file exactly at the budget is not over it",
        documented: true,
        code: sourceOfThreeLines,
        options: [{ maxLines: 3 }],
      },
      {
        name: "options that name no budget leave the default budget in place",
        code: sourceOf399Lines,
        options: [{}],
      },
      {
        name: "a raised budget lets through a file the default would report",
        code: sourceOf450Lines,
        options: [{ maxLines: 500 }],
      },
      {
        name: "blank lines carry no code and are not counted",
        code: "const first = 1;\n\n\nconst second = 2;\n\n\nconst third = 3;",
        options: [{ maxLines: 3 }],
      },
      {
        name: "a line carrying only a line comment is not counted",
        documented: true,
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
        code: `${sourceOfThreeLines}\n`,
        options: [{ maxLines: 3 }],
      },
      {
        name: "a file holding nothing but comments has no code lines at all",
        code: "// one\n// two\n// three\n// four",
        options: [{ maxLines: 1 }],
      },
      {
        name: "a spec file carries a budget of its own that the source budget would refuse",
        filename: "owner.test.ts",
        code: sourceOf1499Lines,
      },
      {
        name: "a raised spec budget lets through a spec the spec default would report",
        filename: "owner.test.ts",
        code: sourceOf1501Lines,
        options: [{ maxSpecLines: 1600 }],
      },
      {
        name: "a spelling given for spec files decides which budget a file draws on",
        filename: "owner.spec.ts",
        code: sourceOf1499Lines,
        options: [{ specFileSuffixes: [".spec.ts"] }],
      },
    ],
    invalid: [
      {
        name: "a file one line past the default budget is reported",
        code: sourceOf501Lines,
        errors: [{ messageId: "oversizedFile", data: { codeLines: 501, maxLines: 500 } }],
      },
      {
        name: "an options object without the key falls back to the default budget",
        code: sourceOf501Lines,
        options: [{}],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 501, maxLines: 500 } }],
      },
      {
        name: "a spec file one line past the spec budget is reported",
        filename: "owner.test.ts",
        code: sourceOf1501Lines,
        errors: [{ messageId: "oversizedFile", data: { codeLines: 1501, maxLines: 1500 } }],
      },
      {
        name: "a lowered budget reports the whole program rather than a line inside it",
        documented: true,
        code: sourceOfFourLines,
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
        code: sourceOfFiveLines,
        options: [{ maxLines: 1 }],
        errors: [{ messageId: "oversizedFile", data: { codeLines: 5, maxLines: 1 } }],
      },
      {
        name: "a template literal spanning lines counts every line it spans, blank ones included",
        documented: true,
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

  it("the options schema declares both budgets and the spec spelling, and refuses any other key", () => {
    expect(optionsSchema).toStrictEqual([
      {
        type: "object",
        properties: {
          maxLines: { type: "integer", minimum: 1 },
          maxSpecLines: { type: "integer", minimum: 1 },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
