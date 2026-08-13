import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import {
  calleeMemberName,
  isFiniteVocabulary,
  literalUnionValues,
  propertyKeyName,
  schemaUnionLiterals,
  staticArrayValues,
} from "./finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

const PROBE_META = {
  type: "problem" as const,
  docs: { description: "reports what the reader under test read", relatedGuidelines: [] },
  messages: { read: "{{text}}" },
  schema: [],
};

describe("isFiniteVocabulary", () => {
  describe("two distinct spellings", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft", "published"]));

    it("are a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("one spelling", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft"]));

    it("names a single value rather than a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("the same spelling repeated", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft", "draft"]));

    it("is still one value", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("both booleans spelled out", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([true, false]));

    it("are the two sides of a flag, not a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a boolean beside a spelling", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([true, "draft"]));

    it("is a vocabulary because the flag is not the whole set", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a number and the same digits written as text", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([1, "1"]));

    it("are two values", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });
});

describe("staticArrayValues", () => {
  testLintRule(
    {
      name: "probe-static-array-values",
      meta: PROBE_META,
      create(context) {
        return {
          ArrayExpression(node: ESTree.ArrayExpression) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(staticArrayValues(node)) },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'const a = ["draft", 1, true, -2]; reads as ["draft",1,true,-2]',
          code: 'const a = ["draft", 1, true, -2];',
          errors: [{ messageId: "read", data: { text: '["draft",1,true,-2]' } }],
        },
        {
          name: 'const a = [`draft`]; reads as ["draft"]',
          code: "const a = [`draft`];",
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
        {
          name: "const a = [`draft${suffix}`]; reads as null",
          code: "const a = [`draft${suffix}`];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = [null]; reads as null",
          code: "const a = [null];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = [/draft/u]; reads as null",
          code: "const a = [/draft/u];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = [-`draft`]; reads as null",
          code: "const a = [-`draft`];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = [status]; reads as null",
          code: "const a = [status];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'const a = [, "draft"]; reads as null',
          code: 'const a = [, "draft"];',
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = [...rest]; reads as null",
          code: "const a = [...rest];",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'const a = ["draft" as const]; reads as ["draft"]',
          code: 'const a = ["draft" as const];',
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
        {
          name: 'const a = ["draft" satisfies string]; reads as ["draft"]',
          code: 'const a = ["draft" satisfies string];',
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
        {
          name: 'const a = [<string>"draft"]; reads as ["draft"]',
          code: 'const a = [<string>"draft"];',
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
      ],
    },
  );
});

describe("literalUnionValues", () => {
  testLintRule(
    {
      name: "probe-literal-union-values",
      meta: PROBE_META,
      create(context) {
        return {
          TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(literalUnionValues(node.typeAnnotation)) },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'type A = "draft" | "published"; reads as ["draft","published"]',
          code: 'type A = "draft" | "published";',
          errors: [{ messageId: "read", data: { text: '["draft","published"]' } }],
        },
        {
          name: "type A = string; reads as null",
          code: "type A = string;",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'type A = "draft" | null; reads as ["draft"]',
          code: 'type A = "draft" | null;',
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
        {
          name: 'type A = "draft" | undefined; reads as ["draft"]',
          code: 'type A = "draft" | undefined;',
          errors: [{ messageId: "read", data: { text: '["draft"]' } }],
        },
        {
          name: 'type A = `draft` | "published"; reads as ["draft","published"]',
          code: 'type A = `draft` | "published";',
          errors: [{ messageId: "read", data: { text: '["draft","published"]' } }],
        },
        {
          name: 'type A = "draft" | string; reads as null',
          code: 'type A = "draft" | string;',
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'type A = `draft${string}` | "published"; reads as null',
          code: 'type A = `draft${string}` | "published";',
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
      ],
    },
  );
});

describe("schemaUnionLiterals", () => {
  testLintRule(
    {
      name: "probe-schema-union-literals",
      meta: PROBE_META,
      create(context) {
        return {
          CallExpression(node: ESTree.CallExpression) {
            if (calleeMemberName(node.callee) !== "union") return;
            const read = schemaUnionLiterals(node);
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(read === null ? null : read.values) },
            });
          },
        };
      },
    },
    {
      valid: [
        { name: "a call that names no member is not a schema call", code: 'union(["draft"]);' },
        { name: "a member reached through a computed name is not read", code: 'z["union"]([]);' },
        { name: "a member that is not a union is not read", code: 'z.enum(["draft"]);' },
        {
          name: "a private method is not a member that can be named",
          code: "class Schemas {\n  #union(members) {\n    return members;\n  }\n  build() {\n    return this.#union([]);\n  }\n}",
        },
      ],
      invalid: [
        {
          name: 'z.union([z.literal("draft"), z.literal("published")]); reads as ["draft","published"]',
          code: 'z.union([z.literal("draft"), z.literal("published")]);',
          errors: [{ messageId: "read", data: { text: '["draft","published"]' } }],
        },
        {
          name: "z.union(); reads as null",
          code: "z.union();",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union(...schemas); reads as null",
          code: "z.union(...schemas);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union(schemas); reads as null",
          code: "z.union(schemas);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union([...schemas]); reads as null",
          code: "z.union([...schemas]);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'z.union(["draft"]); reads as null',
          code: 'z.union(["draft"]);',
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: 'z.union([literal("draft")]); reads as null',
          code: 'z.union([literal("draft")]);',
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union([z.literal()]); reads as null",
          code: "z.union([z.literal()]);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union([z.literal(...spellings)]); reads as null",
          code: "z.union([z.literal(...spellings)]);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "z.union([z.literal(status)]); reads as null",
          code: "z.union([z.literal(status)]);",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
      ],
    },
  );
});

describe("propertyKeyName", () => {
  testLintRule(
    {
      name: "probe-property-key-name",
      meta: PROBE_META,
      create(context) {
        return {
          Property(node: ESTree.ObjectProperty) {
            context.report({
              node,
              messageId: "read",
              data: { text: JSON.stringify(propertyKeyName(node.key)) },
            });
          },
        };
      },
    },
    {
      valid: [],
      invalid: [
        {
          name: 'const a = { draft: 1 }; reads as "draft"',
          code: "const a = { draft: 1 };",
          errors: [{ messageId: "read", data: { text: '"draft"' } }],
        },
        {
          name: 'const a = { "draft": 1 }; reads as "draft"',
          code: 'const a = { "draft": 1 };',
          errors: [{ messageId: "read", data: { text: '"draft"' } }],
        },
        {
          name: "const a = { 1: 1 }; reads as null",
          code: "const a = { 1: 1 };",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
        {
          name: "const a = { [suffix + 1]: 1 }; reads as null",
          code: "const a = { [suffix + 1]: 1 };",
          errors: [{ messageId: "read", data: { text: "null" } }],
        },
      ],
    },
  );
});
