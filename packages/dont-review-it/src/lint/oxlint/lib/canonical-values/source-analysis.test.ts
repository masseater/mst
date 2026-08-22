import { describe, expect, test } from "vite-plus/test";

import { sourceNodes } from "./source-analysis.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

describe("source analysis", () => {
  const it = test.extend("traversedSourceNodes", () => {
    const program = {
      type: "Program",
      start: 0,
      end: 3,
      range: [0, 3] as [number, number],
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
      body: [],
      comments: [],
      tokens: [],
      parent: null,
      sourceType: "module",
    } satisfies ESTree.Program;
    const ast = {
      ...program,
      arrayField: [{ type: "Literal" }],
      scalarField: { type: "Identifier" },
      textField: "not a node",
    };
    const sourceCode: Pick<SourceCode, "ast" | "visitorKeys"> = {
      ast,
      visitorKeys: {
        Program: ["arrayField", "scalarField", "textField"],
        Literal: [],
      },
    };

    return sourceNodes(sourceCode);
  });

  it("the traversal yields the program, the node inside the array field and the node in the scalar field, and skips the field that holds no node", ({
    traversedSourceNodes,
  }) => {
    expect(traversedSourceNodes).toStrictEqual([
      {
        ancestors: [],
        node: {
          type: "Program",
          start: 0,
          end: 3,
          range: [0, 3],
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
          body: [],
          comments: [],
          tokens: [],
          parent: null,
          sourceType: "module",
          arrayField: [{ type: "Literal" }],
          scalarField: { type: "Identifier" },
          textField: "not a node",
        },
      },
      {
        ancestors: [
          {
            type: "Program",
            start: 0,
            end: 3,
            range: [0, 3],
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
            body: [],
            comments: [],
            tokens: [],
            parent: null,
            sourceType: "module",
            arrayField: [{ type: "Literal" }],
            scalarField: { type: "Identifier" },
            textField: "not a node",
          },
        ],
        node: { type: "Literal" },
      },
      {
        ancestors: [
          {
            type: "Program",
            start: 0,
            end: 3,
            range: [0, 3],
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
            body: [],
            comments: [],
            tokens: [],
            parent: null,
            sourceType: "module",
            arrayField: [{ type: "Literal" }],
            scalarField: { type: "Identifier" },
            textField: "not a node",
          },
        ],
        node: { type: "Identifier" },
      },
    ]);
  });
});
