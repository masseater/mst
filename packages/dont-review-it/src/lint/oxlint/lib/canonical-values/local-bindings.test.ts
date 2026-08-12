import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { collectFileBindings, firstNonSpreadArgument } from "./local-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

const PROBE_META = {
  type: "problem" as const,
  docs: { description: "reports what the reader under test read", relatedGuidelines: [] },
  messages: { read: "{{text}}" },
  schema: [],
};

describe("local-bindings", () => {
  testLintRule(
    {
      name: "probe-collect-file-bindings",
      meta: PROBE_META,
      create(context) {
        return {
          "Program:exit"(node: ESTree.Program) {
            const bindings = collectFileBindings(node, context.sourceCode.text);
            context.report({
              node,
              messageId: "read",
              data: {
                text: `${[...bindings.arrays.keys()].join(",")} | ${[...bindings.namedImports].map(([local, specifier]) => `${local}=${specifier}`).join(",")}`,
              },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'const STATUSES = ["draft"]; reads as STATUSES | ',
          code: 'const STATUSES = ["draft"];',
          errors: [{ messageId: "read", data: { text: "STATUSES | " } }],
        },
        {
          name: 'export const STATUSES = ["draft"]; reads as STATUSES | ',
          code: 'export const STATUSES = ["draft"];',
          errors: [{ messageId: "read", data: { text: "STATUSES | " } }],
        },
        {
          name: 'const STATUSES = ["draft"] as const; reads as STATUSES | ',
          code: 'const STATUSES = ["draft"] as const;',
          errors: [{ messageId: "read", data: { text: "STATUSES | " } }],
        },
        {
          name: 'const [first] = ["draft"]; reads as  | ',
          code: 'const [first] = ["draft"];',
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
        {
          name: "let pending; reads as  | ",
          code: "let pending;",
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
        {
          name: 'const total = 1; and const STATUSES = ["draft"]; read as STATUSES | ',
          code: 'const total = 1;\nconst STATUSES = ["draft"];',
          errors: [{ messageId: "read", data: { text: "STATUSES | " } }],
        },
        {
          name: 'import { STATUSES } from "./vocabulary.ts"; reads as  | STATUSES=./vocabulary.ts',
          code: 'import { STATUSES } from "./vocabulary.ts";',
          errors: [{ messageId: "read", data: { text: " | STATUSES=./vocabulary.ts" } }],
        },
        {
          name: 'import vocabulary from "./vocabulary.ts"; reads as  | ',
          code: 'import vocabulary from "./vocabulary.ts";',
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
        {
          name: 'import * as vocabulary from "./vocabulary.ts"; reads as  | ',
          code: 'import * as vocabulary from "./vocabulary.ts";',
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
        {
          name: 'export { STATUSES } from "./vocabulary.ts"; reads as  | ',
          code: 'export { STATUSES } from "./vocabulary.ts";',
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
        {
          name: "export type Draft = { readonly id: string }; reads as  | ",
          code: "export type Draft = { readonly id: string };",
          errors: [{ messageId: "read", data: { text: " | " } }],
        },
      ],
    },
  );

  testLintRule(
    {
      name: "probe-first-non-spread-argument",
      meta: PROBE_META,
      create(context) {
        return {
          CallExpression(node: ESTree.CallExpression) {
            const argument = firstNonSpreadArgument(node);
            context.report({
              node,
              messageId: "read",
              data: { text: argument === null ? "none" : argument.type },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'enumOf(["draft"]); reads as ArrayExpression',
          code: 'enumOf(["draft"]);',
          errors: [{ messageId: "read", data: { text: "ArrayExpression" } }],
        },
        {
          name: "enumOf(STATUSES); reads as Identifier",
          code: "enumOf(STATUSES);",
          errors: [{ messageId: "read", data: { text: "Identifier" } }],
        },
        {
          name: "enumOf(); reads as none",
          code: "enumOf();",
          errors: [{ messageId: "read", data: { text: "none" } }],
        },
        {
          name: "enumOf(...schemas); reads as none",
          code: "enumOf(...schemas);",
          errors: [{ messageId: "read", data: { text: "none" } }],
        },
      ],
    },
  );
});
