import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { collectFileBindings, firstNonSpreadArgument } from "./local-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

const PROBE_META = {
  type: "problem" as const,
  docs: { description: "reports what the reader under test read", relatedGuidelines: [] },
  messages: { read: "{{text}}" },
  schema: [],
};

const bindingsReader: WorkspaceLintRule = {
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
};

const argumentReader: WorkspaceLintRule = {
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
};

const reads = (code: string, ...texts: readonly string[]) => ({
  name: `${code} reads as ${texts.join(" then ")}`,
  code,
  errors: texts.map((text) => ({ messageId: "read", data: { text } })),
});

describe("local-bindings", () => {
  testLintRule(bindingsReader, {
    valid: [],
    invalid: [
      reads('const STATUSES = ["draft"];', "STATUSES | "),
      reads('export const STATUSES = ["draft"];', "STATUSES | "),
      reads('const STATUSES = ["draft"] as const;', "STATUSES | "),
      reads('const [first] = ["draft"];', " | "),
      reads("let pending;", " | "),
      reads('const total = 1;\nconst STATUSES = ["draft"];', "STATUSES | "),
      reads('import { STATUSES } from "./vocabulary.ts";', " | STATUSES=./vocabulary.ts"),
      reads('import vocabulary from "./vocabulary.ts";', " | "),
      reads('import * as vocabulary from "./vocabulary.ts";', " | "),
      reads('export { STATUSES } from "./vocabulary.ts";', " | "),
      reads("export type Draft = { readonly id: string };", " | "),
    ],
  });

  testLintRule(argumentReader, {
    valid: [],
    invalid: [
      reads('enumOf(["draft"]);', "ArrayExpression"),
      reads("enumOf(STATUSES);", "Identifier"),
      reads("enumOf();", "none"),
      reads("enumOf(...schemas);", "none"),
    ],
  });
});
