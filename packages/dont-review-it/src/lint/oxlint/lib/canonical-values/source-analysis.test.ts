import { describe, expect, test } from "vite-plus/test";

import { sourceNodes } from "./source-analysis.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

describe("source analysis", () => {
  test("the pre-analysis traverses scalar and array visitor fields and ignores non-nodes", () => {
    const location = {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 3 },
    };
    const program = {
      type: "Program",
      start: 0,
      end: 3,
      range: [0, 3] as [number, number],
      loc: location,
      body: [],
      comments: [],
      tokens: [],
      parent: null,
      sourceType: "module",
    } satisfies ESTree.Program;
    const literal = {
      type: "Literal",
      start: 0,
      end: 1,
      range: [0, 1] as [number, number],
      loc: location,
      parent: program,
      raw: "1",
      value: 1,
    } satisfies ESTree.NumericLiteral;
    const identifier = {
      type: "Identifier",
      start: 2,
      end: 3,
      range: [2, 3] as [number, number],
      loc: location,
      parent: program,
      name: "value",
    } satisfies ESTree.IdentifierReference;
    const ast = { ...program, items: [literal], extra: identifier, ignored: "value" };
    const sourceCode: Pick<SourceCode, "ast" | "visitorKeys"> = {
      ast,
      visitorKeys: {
        Program: ["items", "extra", "ignored"],
        Literal: [],
      },
    };

    expect(sourceNodes(sourceCode).map(({ node }) => node.type)).toStrictEqual([
      "Program",
      "Literal",
      "Identifier",
    ]);
  });
});
