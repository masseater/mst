import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
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

const spelt = (held: unknown): string => JSON.stringify(held);

const valueReader: WorkspaceLintRule = {
  name: "probe-literal-held",
  meta: PROBE_META,
  create(inspection) {
    return {
      Literal(node: LiteralNode) {
        inspection.report({ node, messageId: "read", data: { text: spelt(literalValue(node)) } });
      },
      TemplateLiteral(node: ESTree.TemplateLiteral) {
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(templateLiteralValue(node)) },
        });
      },
      UnaryExpression(node: ESTree.UnaryExpression) {
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(negatedNumericValue(node)) },
        });
      },
    };
  },
};

const positionReader: WorkspaceLintRule = {
  name: "probe-literal-position",
  meta: PROBE_META,
  create(inspection) {
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
        inspection.report({ node, messageId: "read", data: { text: held.join(" ") } });
      },
    };
  },
};

const reads = (code: string, ...writtenTexts: readonly string[]) => ({
  name: `${code} reads as ${writtenTexts.join(" then ")}`,
  code,
  errors: writtenTexts.map((writtenText) => ({ messageId: "read", data: { text: writtenText } })),
});

const STRUCTURAL = "true false false";

const MODULE = "false true false";

const SELECTOR = "false false true";

describe("literal-position", () => {
  testLintRule(valueReader, {
    valid: [],
    invalid: [
      reads('const a = "draft";', '"draft"'),
      reads("const a = 1;", "1"),
      reads("const a = true;", "true"),
      reads("const a = null;", "null"),
      reads("const a = /draft/u;", "null"),
      reads("const a = 1n;", "null"),
      reads("const a = `draft`;", '"draft"'),
      reads("const a = `draft${suffix}`;", "null"),
      reads("const a = -1;", "-1", "1"),
      reads('const a = -"draft";', "null", '"draft"'),
      reads("const a = -status;", "null"),
      reads("const a = !flag;", "null"),
    ],
  });

  testLintRule(positionReader, {
    valid: [
      { name: "a plain binding is in none of these positions", code: 'const a = "draft";' },
      { name: "a computed key is not a structural key", code: 'const a = { ["draft"]: 1 };' },
      {
        name: "a computed type member key is not a structural key",
        code: 'type A = { ["draft"]: string };',
      },
      { name: "an enum held is not the member name", code: 'enum A { draft = "draft" }' },
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
      reads('const a = { "draft": 1 };', STRUCTURAL),
      reads('class A { "draft"() {} }', STRUCTURAL),
      reads('class A { "draft" = 1; }', STRUCTURAL),
      reads('class A { accessor "draft" = 1; }', STRUCTURAL),
      reads('type A = { "draft": string };', STRUCTURAL),
      reads('type A = { "draft"(): void };', STRUCTURAL),
      reads('abstract class A { abstract "draft": string; }', STRUCTURAL),
      reads('abstract class A { abstract "draft"(): void; }', STRUCTURAL),
      reads('abstract class A { abstract accessor "draft": string; }', STRUCTURAL),
      reads('enum A { "draft" = 1 }', STRUCTURAL),
      reads('import "draft";', MODULE),
      reads('export {} from "draft";', MODULE),
      reads('const a = import("draft");', MODULE),
      reads('type A = import("draft").B;', MODULE),
      reads('export * from "draft";', MODULE),
      reads('export * as "draft" from "other";', MODULE, MODULE),
      reads('import a from "other" with { type: "draft" };', MODULE, MODULE),
      reads('import { "draft" as b } from "other";', MODULE, MODULE),
      reads('export { "draft" as "other" } from "elsewhere";', MODULE, MODULE, MODULE),
      reads('declare module "draft" {}', MODULE),
      reads('type A = Omit<B, "draft">;', SELECTOR),
      reads('type A = Pick<B, "draft">;', SELECTOR),
    ],
  });
});
