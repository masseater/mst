import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
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

const spelt = (held: unknown): string => JSON.stringify(held);

const arrayReader: WorkspaceLintRule = {
  name: "probe-static-array-values",
  meta: PROBE_META,
  create(inspection) {
    return {
      ArrayExpression(node: ESTree.ArrayExpression) {
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(staticArrayValues(node)) },
        });
      },
    };
  },
};

const unionTypeReader: WorkspaceLintRule = {
  name: "probe-literal-union-values",
  meta: PROBE_META,
  create(inspection) {
    return {
      TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(literalUnionValues(node.typeAnnotation)) },
        });
      },
    };
  },
};

const schemaReader: WorkspaceLintRule = {
  name: "probe-schema-union-literals",
  meta: PROBE_META,
  create(inspection) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (calleeMemberName(node.callee) !== "union") return;
        const read = schemaUnionLiterals(node);
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(read === null ? null : read.values) },
        });
      },
    };
  },
};

const propertyKeyReader: WorkspaceLintRule = {
  name: "probe-property-key-name",
  meta: PROBE_META,
  create(inspection) {
    return {
      Property(node: ESTree.ObjectProperty) {
        inspection.report({
          node,
          messageId: "read",
          data: { text: spelt(propertyKeyName(node.key)) },
        });
      },
    };
  },
};

const reads = (code: string, writtenText: string) => ({
  name: `${code} reads as ${writtenText}`,
  code,
  errors: [{ messageId: "read", data: { text: writtenText } }],
});

describe("finite-held-syntax", () => {
  test("two distinct spellings are a vocabulary", () => {
    expect(isFiniteVocabulary(["draft", "published"])).toBe(true);
  });

  test("one spelling names a single held rather than a vocabulary", () => {
    expect(isFiniteVocabulary(["draft"])).toBe(false);
  });

  test("the same spelling repeated is still one held", () => {
    expect(isFiniteVocabulary(["draft", "draft"])).toBe(false);
  });

  test("both booleans spelled out are the two sides of a flag, not a vocabulary", () => {
    expect(isFiniteVocabulary([true, false])).toBe(false);
  });

  test("a boolean beside a spelling is a vocabulary because the flag is not the whole set", () => {
    expect(isFiniteVocabulary([true, "draft"])).toBe(true);
  });

  test("a number and the same digits written as writtenText are two values", () => {
    expect(isFiniteVocabulary([1, "1"])).toBe(true);
  });

  testLintRule(arrayReader, {
    valid: [],
    invalid: [
      reads('const a = ["draft", 1, true, -2];', '["draft",1,true,-2]'),
      reads("const a = [`draft`];", '["draft"]'),
      reads("const a = [`draft${suffix}`];", "null"),
      reads("const a = [null];", "null"),
      reads("const a = [/draft/u];", "null"),
      reads("const a = [-`draft`];", "null"),
      reads("const a = [status];", "null"),
      reads('const a = [, "draft"];', "null"),
      reads("const a = [...rest];", "null"),
      reads('const a = ["draft" as const];', '["draft"]'),
      reads('const a = ["draft" satisfies string];', '["draft"]'),
      reads('const a = [<string>"draft"];', '["draft"]'),
    ],
  });

  testLintRule(unionTypeReader, {
    valid: [],
    invalid: [
      reads('type A = "draft" | "published";', '["draft","published"]'),
      reads("type A = string;", "null"),
      reads('type A = "draft" | null;', '["draft"]'),
      reads('type A = "draft" | undefined;', '["draft"]'),
      reads('type A = `draft` | "published";', '["draft","published"]'),
      reads('type A = "draft" | string;', "null"),
      reads('type A = `draft${string}` | "published";', "null"),
    ],
  });

  testLintRule(schemaReader, {
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
      reads('z.union([z.literal("draft"), z.literal("published")]);', '["draft","published"]'),
      reads("z.union();", "null"),
      reads("z.union(...schemas);", "null"),
      reads("z.union(schemas);", "null"),
      reads("z.union([...schemas]);", "null"),
      reads('z.union(["draft"]);', "null"),
      reads('z.union([literal("draft")]);', "null"),
      reads("z.union([z.literal()]);", "null"),
      reads("z.union([z.literal(...spellings)]);", "null"),
      reads("z.union([z.literal(status)]);", "null"),
    ],
  });

  testLintRule(propertyKeyReader, {
    valid: [],
    invalid: [
      reads("const a = { draft: 1 };", '"draft"'),
      reads('const a = { "draft": 1 };', '"draft"'),
      reads("const a = { 1: 1 };", "null"),
      reads("const a = { [suffix + 1]: 1 };", "null"),
    ],
  });
});
