import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noMultiBindingDeclaration } from "./no-multi-binding-declaration--declare-one-binding-per-statement.ts";

describe("dont-review-it/no-multi-binding-declaration--declare-one-binding-per-statement", () => {
  testLintRule(noMultiBindingDeclaration, {
    valid: [
      {
        name: "one binding per statement is the shape the rule asks for",
        code: "const parsedCount = 1;\nconst renderedLabel = 'a';",
      },
      {
        name: "a statement that binds nothing has no bindings to split",
        code: "let parsedCount;",
      },
      {
        name: "a destructuring pattern is one binding site however many names it introduces",
        code: "const { parsedCount, renderedLabel } = source;",
      },
      {
        name: "an array pattern is likewise one binding site",
        code: "const [parsedCount, renderedLabel] = source;",
      },
      {
        name: "a for statement header has nowhere to put a second statement",
        code: "for (let index = 0, limit = 10; index < limit; index += 1) {\n  report(index);\n}",
      },
      {
        name: "a for-of header binds once",
        code: "for (const entry of entries) {\n  report(entry);\n}",
      },
    ],
    invalid: [
      {
        name: "two bindings in one const statement are reported",
        code: "const parsedCount = 1, renderedLabel = 'a';",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "two bindings in one let statement are reported",
        code: "let parsedCount = 1, renderedLabel = 'a';",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "a declaration without initialisers is reported the same way",
        code: "let parsedCount, renderedLabel;",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "three bindings are one report on the statement that carries them",
        code: "const parsedCount = 1, renderedLabel = 'a', reportedAt = 2;",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "a var statement is reported although another rule also rejects the keyword",
        code: "var parsedCount = 1, renderedLabel = 'a';",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "a declaration inside a block is reported where it sits",
        code: "function report() {\n  const parsedCount = 1, renderedLabel = 'a';\n  return parsedCount;\n}",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
      {
        name: "a for statement body is not the header, so the exemption does not reach it",
        code: "for (const entry of entries) {\n  const parsedCount = 1, renderedLabel = 'a';\n}",
        errors: [{ messageId: "multiBindingDeclaration" }],
      },
    ],
  });
});
