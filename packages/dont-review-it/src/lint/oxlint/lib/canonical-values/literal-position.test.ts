import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import {
  ancestorsOf,
  isKeySelectorArgument,
  isModuleSyntaxPosition,
  isStructuralKeyPosition,
  literalValue,
  negatedNumericValue,
  templateLiteralValue,
  type LiteralNode,
} from "./literal-position.ts";

import type { ESTree } from "@oxlint/plugins";

const PROBE_META = {
  type: "problem" as const,
  docs: { description: "reports what the reader under test read", relatedGuidelines: [] },
  messages: { read: "{{text}}" },
  schema: [],
};

const STRUCTURAL = "true false false";

const MODULE = "false true false";

const SELECTOR = "false false true";

describe("literal-position", () => {
  testLintRule(
    {
      name: "probe-literal-value",
      meta: PROBE_META,
      create(context) {
        return {
          Literal(node: LiteralNode) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(literalValue(node)) },
            });
          },
          TemplateLiteral(node: ESTree.TemplateLiteral) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(templateLiteralValue(node)) },
            });
          },
          UnaryExpression(node: ESTree.UnaryExpression) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(negatedNumericValue(node)) },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'const a = "draft"; reads as "draft"',
          code: 'const a = "draft";',
          errors: [{ messageId: "read", data: { text: '"draft"' } }],
        },
        {
          name: "const a = 1; reads as 1",
          code: "const a = 1;",
          errors: [{ messageId: "read", data: { text: "1" } }],
        },
        {
          name: "const a = true; reads as true",
          code: "const a = true;",
          errors: [{ messageId: "read", data: { text: "true" } }],
        },
        {
          name: "const a = null; reads as null",
          code: "const a = null;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = /draft/u; reads as null",
          code: "const a = /draft/u;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = 1n; reads as null",
          code: "const a = 1n;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'const a = `draft`; reads as "draft"',
          code: "const a = `draft`;",
          errors: [{ messageId: "read", data: { text: '"draft"' } }],
        },
        {
          name: "const a = `draft${suffix}`; reads as null",
          code: "const a = `draft${suffix}`;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = -1; reads as -1 then 1",
          code: "const a = -1;",
          errors: [
            { messageId: "read", data: { text: "-1" } },
            { messageId: "read", data: { text: "1" } },
          ],
        },
        {
          name: 'const a = -"draft"; reads as null then "draft"',
          code: 'const a = -"draft";',
          errors: [
            { messageId: "read", data: { text: "null" } },
            { messageId: "read", data: { text: '"draft"' } },
          ],
        },
        {
          name: "const a = -status; reads as null",
          code: "const a = -status;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = !flag; reads as null",
          code: "const a = !flag;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
      ],
    },
  );

  testLintRule(
    {
      name: "probe-literal-position",
      meta: PROBE_META,
      create(context) {
        return {
          Literal(node: LiteralNode) {
            const ancestors = ancestorsOf(node);
            const parent = ancestors.at(-1) ?? node;
            const held = [
              isStructuralKeyPosition(parent, node),
              isModuleSyntaxPosition(parent, node),
              isKeySelectorArgument(ancestors),
            ];
            if (!held.includes(true)) return;
            context.report({ node, messageId: "read", data: { text: held.join(" ") } });
          },
        };
      },
    },
    {
      valid: [
        { name: "a plain binding is in none of these positions", code: 'const a = "draft";' },
        { name: "a computed key is not a structural key", code: 'const a = { ["draft"]: 1 };' },
        {
          name: "a computed type member key is not a structural key",
          code: 'type A = { ["draft"]: string };',
        },
        { name: "an enum value is not the member name", code: 'enum A { draft = "draft" }' },
        {
          name: "a selector that is not a key selection is left alone",
          code: 'type A = Record<string, "draft">;',
        },
        {
          name: "a selector reached through a computed name is left alone",
          code: 'type A = ns.Omit<B, "draft">;',
        },
        {
          name: "the first argument of a key selection is not the selector",
          code: 'type A = Omit<"draft", B>;',
        },
      ],
      invalid: [
        {
          name: 'const a = { "draft": 1 }; reads as true false false',
          code: 'const a = { "draft": 1 };',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'class A { "draft"() {} } reads as true false false',
          code: 'class A { "draft"() {} }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'class A { "draft" = 1; } reads as true false false',
          code: 'class A { "draft" = 1; }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'class A { accessor "draft" = 1; } reads as true false false',
          code: 'class A { accessor "draft" = 1; }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'type A = { "draft": string }; reads as true false false',
          code: 'type A = { "draft": string };',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'type A = { "draft"(): void }; reads as true false false',
          code: 'type A = { "draft"(): void };',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'abstract class A { abstract "draft": string; } reads as true false false',
          code: 'abstract class A { abstract "draft": string; }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'abstract class A { abstract "draft"(): void; } reads as true false false',
          code: 'abstract class A { abstract "draft"(): void; }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'abstract class A { abstract accessor "draft": string; } reads as true false false',
          code: 'abstract class A { abstract accessor "draft": string; }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'enum A { "draft" = 1 } reads as true false false',
          code: 'enum A { "draft" = 1 }',
          errors: [{ messageId: "read", data: { text: STRUCTURAL } }],
        },
        {
          name: 'import "draft"; reads as false true false',
          code: 'import "draft";',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'export {} from "draft"; reads as false true false',
          code: 'export {} from "draft";',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'const a = import("draft"); reads as false true false',
          code: 'const a = import("draft");',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'type A = import("draft").B; reads as false true false',
          code: 'type A = import("draft").B;',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'export * from "draft"; reads as false true false',
          code: 'export * from "draft";',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'export * as "draft" from "other"; reads as false true false then false true false',
          code: 'export * as "draft" from "other";',
          errors: [
            { messageId: "read", data: { text: MODULE } },
            { messageId: "read", data: { text: MODULE } },
          ],
        },
        {
          name: 'import a from "other" with { type: "draft" }; reads as false true false then false true false',
          code: 'import a from "other" with { type: "draft" };',
          errors: [
            { messageId: "read", data: { text: MODULE } },
            { messageId: "read", data: { text: MODULE } },
          ],
        },
        {
          name: 'import { "draft" as b } from "other"; reads as false true false then false true false',
          code: 'import { "draft" as b } from "other";',
          errors: [
            { messageId: "read", data: { text: MODULE } },
            { messageId: "read", data: { text: MODULE } },
          ],
        },
        {
          name: 'export { "draft" as "other" } from "elsewhere"; reads as false true false then false true false then false true false',
          code: 'export { "draft" as "other" } from "elsewhere";',
          errors: [
            { messageId: "read", data: { text: MODULE } },
            { messageId: "read", data: { text: MODULE } },
            { messageId: "read", data: { text: MODULE } },
          ],
        },
        {
          name: 'declare module "draft" {} reads as false true false',
          code: 'declare module "draft" {}',
          errors: [{ messageId: "read", data: { text: MODULE } }],
        },
        {
          name: 'type A = Omit<B, "draft">; reads as false false true',
          code: 'type A = Omit<B, "draft">;',
          errors: [{ messageId: "read", data: { text: SELECTOR } }],
        },
        {
          name: 'type A = Pick<B, "draft">; reads as false false true',
          code: 'type A = Pick<B, "draft">;',
          errors: [{ messageId: "read", data: { text: SELECTOR } }],
        },
      ],
    },
  );
});
