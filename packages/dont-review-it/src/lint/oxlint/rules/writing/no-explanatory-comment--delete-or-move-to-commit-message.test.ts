import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExplanatoryComment } from "./no-explanatory-comment--delete-or-move-to-commit-message.ts";

describe("dont-review-it/no-explanatory-comment--delete-or-move-to-commit-message", () => {
  testLintRule(noExplanatoryComment, {
    valid: [
      { name: "source without any comment passes", code: "const total = 1 + 2;" },
      {
        name: "a lint suppression directive is a declaration a machine reads",
        documented: true,
        code: "// oxlint-disable-next-line no-console -- the CLI writes its result here\nconsole.log(1);",
      },
      {
        name: "a compiler directive is a declaration a machine reads",
        code: "// @ts-nocheck\nconst total = 1;",
      },
      {
        name: "a mock factory exemption is a declaration a machine reads",
        code: '// mock-factory-exemption no-vi-mock-factory-behavior--use-spy-true-and-fixture -- this unit test replaces the child module boundary on purpose\nvi.mock("./child.ts", () => ({ read: vi.fn() }));',
      },
      {
        name: "a JSDoc block is judged by no-detached-rationale instead",
        documented: true,
        code: "/**\n * @returns the total\n */\nexport const total = 1;",
      },
      {
        name: "a shebang is not a comment the author wrote to explain code",
        code: "#!/usr/bin/env node\nconst total = 1;",
      },
    ],
    invalid: [
      {
        name: "a line comment explaining the next statement is reported",
        documented: true,
        code: "// add the two operands\nconst total = 1 + 2;",
        errors: [{ messageId: "explanatoryComment" }],
      },
      {
        name: "a trailing line comment is reported",
        code: "const total = 1 + 2; // the running total",
        errors: [{ messageId: "explanatoryComment" }],
      },
      {
        name: "a non JSDoc block comment is reported",
        code: "/* the running total */\nconst total = 1 + 2;",
        errors: [{ messageId: "explanatoryComment" }],
      },
      {
        name: "a commented out statement is reported",
        documented: true,
        code: "// const previous = 1;\nconst total = 2;",
        errors: [{ messageId: "explanatoryComment" }],
      },
      {
        name: "each explanatory comment is reported on its own",
        code: "// first\nconst a = 1;\n// second\nconst b = 2;",
        errors: [{ messageId: "explanatoryComment" }, { messageId: "explanatoryComment" }],
      },
    ],
  });
});
