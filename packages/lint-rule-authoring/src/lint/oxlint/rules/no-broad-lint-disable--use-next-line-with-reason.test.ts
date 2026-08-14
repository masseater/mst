import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noBroadLintDisable } from "./no-broad-lint-disable--use-next-line-with-reason.ts";

describe("lint-rule-authoring/no-broad-lint-disable--use-next-line-with-reason", () => {
  testLintRule(noBroadLintDisable, {
    valid: [
      { name: "source without any comment passes", code: "const total = 1 + 2;" },
      {
        name: "the oxlint next-line form with a rule name and a reason is the sanctioned shape",
        documented: true,
        code: "// oxlint-disable-next-line no-console -- the CLI writes its result here\nconsole.log(1);",
      },
      {
        name: "the eslint next-line form with a rule name and a reason is the sanctioned shape",
        code: "// eslint-disable-next-line no-console -- the CLI writes its result here\nconsole.log(1);",
      },
      {
        name: "the next-line form written as a block comment is still the sanctioned shape",
        code: "/* oxlint-disable-next-line no-console -- the CLI writes its result here */\nconsole.log(1);",
      },
      {
        name: "a comment whose body is only whitespace is not a directive",
        code: "//   \nconst total = 1;",
      },
      {
        name: "prose that names a directive mid sentence is not a directive",
        documented: true,
        code: "// this repository never writes eslint-disable\nconst total = 1;",
      },
      {
        name: "a spelling that merely starts like a broad directive is not one of the four",
        code: "// oxlint-disable-lines no-console\nconst total = 1;",
      },
      {
        name: "re-enabling on its own opens no suppression",
        code: "// oxlint-enable no-console\nconst total = 1;",
      },
      {
        name: "a JSDoc block that mentions a directive starts with the asterisk token",
        code: "/**\n * @see oxlint-disable\n */\nexport const total = 1;",
      },
      {
        name: "a shebang is not a directive",
        code: "#!/usr/bin/env node\nconst total = 1;",
      },
    ],
    invalid: [
      {
        name: "a bare eslint-disable opens the suppression for the rest of the file",
        code: "// eslint-disable\nconst total = 1;",
        errors: [
          {
            messageId: "broadLintDisable",
            data: {
              directive: "eslint-disable",
              nextLineDirective: "eslint-disable-next-line",
            },
          },
        ],
      },
      {
        name: "a bare oxlint-disable opens the suppression for the rest of the file",
        documented: true,
        code: "// oxlint-disable\nconst total = 1;",
        errors: [
          {
            messageId: "broadLintDisable",
            data: {
              directive: "oxlint-disable",
              nextLineDirective: "oxlint-disable-next-line",
            },
          },
        ],
      },
      {
        name: "eslint-disable-line covers the whole line it sits on",
        code: "console.log(1); // eslint-disable-line no-console",
        errors: [
          {
            messageId: "broadLintDisable",
            data: {
              directive: "eslint-disable-line",
              nextLineDirective: "eslint-disable-next-line",
            },
            line: 1,
            column: 16,
            endColumn: 49,
          },
        ],
      },
      {
        name: "oxlint-disable-line is reported even when it already carries a reason",
        documented: true,
        code: "console.log(1); // oxlint-disable-line no-console -- the CLI writes its result here",
        errors: [
          {
            messageId: "broadLintDisable",
            data: {
              directive: "oxlint-disable-line",
              nextLineDirective: "oxlint-disable-next-line",
            },
          },
        ],
      },
      {
        name: "a broad directive written as a block comment is reported",
        code: "/* oxlint-disable no-console */\nconsole.log(1);",
        errors: [{ messageId: "broadLintDisable" }],
      },
      {
        name: "a newline right after the directive name leaves the first token unchanged",
        code: "/* oxlint-disable\n   no-console */\nconsole.log(1);",
        errors: [{ messageId: "broadLintDisable", line: 1, column: 0, endLine: 2, endColumn: 16 }],
      },
      {
        name: "an indented broad directive is reported",
        code: "  // oxlint-disable no-console\nconsole.log(1);",
        errors: [{ messageId: "broadLintDisable" }],
      },
      {
        name: "wrapping a span in a disable and enable pair is reported at the opening disable",
        code: "// oxlint-disable no-console\nconsole.log(1);\nconsole.log(2);\n// oxlint-enable no-console\n",
        errors: [{ messageId: "broadLintDisable" }],
      },
      {
        name: "each broad directive is reported on its own",
        code: "// eslint-disable\nconst a = 1;\n// oxlint-disable-line\nconst b = 2;",
        errors: [{ messageId: "broadLintDisable" }, { messageId: "broadLintDisable" }],
      },
    ],
  });
});
