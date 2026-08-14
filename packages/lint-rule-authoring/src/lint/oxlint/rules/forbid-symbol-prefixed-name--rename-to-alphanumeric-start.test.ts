import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, it } from "vite-plus/test";

import { forbidSymbolPrefixedName } from "./forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";

const declaredOptionsSchema = forbidSymbolPrefixedName.meta.schema;

describe("lint-rule-authoring/forbid-symbol-prefixed-name--rename-to-alphanumeric-start", () => {
  testLintRule(forbidSymbolPrefixedName, {
    valid: [
      {
        name: "every segment of a nested path starts with a letter",
        documented: true,
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/lint/oxlint/rules/some-rule.ts",
      },
      {
        name: "a segment may start with a digit",
        code: "const total = 1;",
        filename: "packages/2024-report/src/index.ts",
      },
      {
        name: "a name the deployment listed is allowed to start with a symbol",
        documented: true,
        code: "const total = 1;",
        filename: ".config/tooling/setup.ts",
        options: [{ allowedNames: [".config"] }],
      },
      {
        name: "a listed name is matched against the whole segment",
        code: "const total = 1;",
        filename: "packages/_ui/index.ts",
        options: [{ allowedNames: ["_ui"] }],
      },
      {
        name: "a wildcard in a listed name stands for any run of characters",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/.storybook/preview.ts",
        options: [{ allowedNames: [".*book"] }],
      },
      {
        name: "a wildcard may stand for nothing at all",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/_.ts",
        options: [{ allowedNames: ["_*.ts"] }],
      },
      {
        name: "options that list no allowed name leave the default empty list in place",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/index.ts",
        options: [{}],
      },
    ],
    invalid: [
      {
        name: "a file name starting with an underscore is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/_internal.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: {
              segment: "_internal.ts",
              path: "packages/lint-rule-authoring/src/_internal.ts",
            },
          },
        ],
      },
      {
        name: "a directory name starting with an underscore is reported",
        documented: true,
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/_internal/helper.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: {
              segment: "_internal",
              path: "packages/lint-rule-authoring/_internal/helper.ts",
            },
          },
        ],
      },
      {
        name: "a directory name starting with a hyphen is reported",
        code: "const total = 1;",
        filename: "packages/-draft/src/index.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "-draft", path: "packages/-draft/src/index.ts" },
          },
        ],
      },
      {
        name: "a file name starting with an at sign is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/src/@entry.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "@entry.ts", path: "packages/lint-rule-authoring/src/@entry.ts" },
          },
        ],
      },
      {
        name: "a hidden directory the deployment has not listed is reported",
        code: "const total = 1;",
        filename: ".config/tooling/setup.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: ".config", path: ".config/tooling/setup.ts" },
          },
        ],
      },
      {
        name: "a hidden file the deployment has not listed is reported",
        code: "const total = 1;",
        filename: "packages/lint-rule-authoring/.setup.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: ".setup.ts", path: "packages/lint-rule-authoring/.setup.ts" },
          },
        ],
      },
      {
        name: "a name that starts with a non ASCII letter is reported",
        code: "const total = 1;",
        filename: "packages/日本語/index.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "日本語", path: "packages/日本語/index.ts" },
          },
        ],
      },
      {
        name: "every offending segment on the path gets its own report, in the order they appear",
        code: "const total = 1;",
        filename: "packages/_draft/src/~scratch.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_draft", path: "packages/_draft/src/~scratch.ts" },
          },
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "~scratch.ts", path: "packages/_draft/src/~scratch.ts" },
          },
        ],
      },
      {
        name: "the same offending name twice on one path is folded into a single report",
        code: "const total = 1;",
        filename: "packages/_shared/_shared/index.ts",
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_shared", path: "packages/_shared/_shared/index.ts" },
          },
        ],
      },
      {
        name: "an allowed name does not carry the allowance down to the names under it",
        documented: true,
        code: "const total = 1;",
        filename: "packages/_ui/_legacy/index.ts",
        options: [{ allowedNames: ["_ui"] }],
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_legacy", path: "packages/_ui/_legacy/index.ts" },
          },
        ],
      },
      {
        name: "a listed name does not allow a longer name that merely starts with it",
        code: "const total = 1;",
        filename: "packages/_ui-legacy/index.ts",
        options: [{ allowedNames: ["_ui"] }],
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_ui-legacy", path: "packages/_ui-legacy/index.ts" },
          },
        ],
      },
      {
        name: "a listed name is matched with the case it was written in",
        code: "const total = 1;",
        filename: "packages/_UI/index.ts",
        options: [{ allowedNames: ["_ui"] }],
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_UI", path: "packages/_UI/index.ts" },
          },
        ],
      },
      {
        name: "a wildcard entry still has to cover the whole segment",
        code: "const total = 1;",
        filename: "packages/_ui-legacy/index.ts",
        options: [{ allowedNames: ["_*-ui"] }],
        errors: [
          {
            messageId: "symbolPrefixedSegment",
            data: { segment: "_ui-legacy", path: "packages/_ui-legacy/index.ts" },
          },
        ],
      },
    ],
  });

  it("the options schema declares the allowed names and refuses any other key", () => {
    expect(declaredOptionsSchema).toStrictEqual([
      {
        type: "object",
        properties: {
          allowedNames: { type: "array", items: { type: "string", pattern: "^[^/]+$" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
