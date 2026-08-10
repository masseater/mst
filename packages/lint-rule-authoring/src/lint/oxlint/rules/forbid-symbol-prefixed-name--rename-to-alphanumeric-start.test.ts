import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidSymbolPrefixedName } from "./forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";

describe("lint-rule-authoring/forbid-symbol-prefixed-name--rename-to-alphanumeric-start", () => {
  testLintRule(forbidSymbolPrefixedName, {
    valid: [
      {
        name: "every segment of a nested path starts with a letter",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/lint/oxlint/rules/some-rule.ts",
      },
      {
        name: "a segment may start with a digit",
        code: "const total = 1;",
        filename: "packages/2024-report/src/index.ts",
      },
      {
        name: "a hidden directory is left to its own convention",
        code: "const total = 1;",
        filename: ".config/tooling/setup.ts",
      },
      {
        name: "a hidden file is left to its own convention",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/.setup.ts",
      },
    ],
    invalid: [
      {
        name: "a file name starting with an underscore is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/_internal.ts",
        errors: [{ messageId: "symbolPrefixedSegment", data: { segment: "_internal.ts" } }],
      },
      {
        name: "a directory name starting with an underscore is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/_internal/helper.ts",
        errors: [{ messageId: "symbolPrefixedSegment", data: { segment: "_internal" } }],
      },
      {
        name: "a directory name starting with a hyphen is reported",
        code: "const total = 1;",
        filename: "packages/-draft/src/index.ts",
        errors: [{ messageId: "symbolPrefixedSegment", data: { segment: "-draft" } }],
      },
      {
        name: "a file name starting with an at sign is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/@entry.ts",
        errors: [{ messageId: "symbolPrefixedSegment", data: { segment: "@entry.ts" } }],
      },
      {
        name: "every offending segment on the path gets its own report",
        code: "const total = 1;",
        filename: "packages/_draft/src/~scratch.ts",
        errors: [
          { messageId: "symbolPrefixedSegment", data: { segment: "_draft" } },
          { messageId: "symbolPrefixedSegment", data: { segment: "~scratch.ts" } },
        ],
      },
    ],
  });
});
