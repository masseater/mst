import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDetachedRationale } from "./no-detached-rationale--comment-at-explained-line.ts";

describe("dont-review-it/no-detached-rationale--comment-at-explained-line", () => {
  testLintRule(noDetachedRationale, {
    valid: [
      {
        name: "a JSDoc block that carries tag content only passes",
        code: "/**\n * @param count how many rows to take\n * @returns the taken rows\n */\nexport const take = (count: number) => count;",
      },
      {
        name: "an empty JSDoc block carries no prose",
        code: "/**\n */\nexport const take = 1;",
      },
      {
        name: "a line comment is judged by no-explanatory-comment instead",
        code: "// take the rows\nexport const take = 1;",
      },
      {
        name: "a non JSDoc block comment is judged by no-explanatory-comment instead",
        code: "/* take the rows */\nexport const take = 1;",
      },
      {
        name: "prose wrapped under a tag belongs to that tag",
        code: "/**\n * @remarks\n *   the caller owns the cursor, so the rows are taken eagerly\n */\nexport const take = 1;",
      },
    ],
    invalid: [
      {
        name: "description prose above the first tag is reported",
        code: "/**\n * Takes the rows the caller asked for.\n * @param count how many rows to take\n */\nexport const take = (count: number) => count;",
        errors: [{ messageId: "jsdocDescriptionProse" }],
      },
      {
        name: "a JSDoc block with prose and no tag at all is reported",
        code: "/**\n * Takes the rows the caller asked for.\n */\nexport const take = 1;",
        errors: [{ messageId: "jsdocDescriptionProse" }],
      },
      {
        name: "a single line JSDoc block carrying prose is reported",
        code: "/** Takes the rows the caller asked for. */\nexport const take = 1;",
        errors: [{ messageId: "jsdocDescriptionProse" }],
      },
    ],
  });
});
