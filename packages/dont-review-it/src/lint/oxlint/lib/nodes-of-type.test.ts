import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodesOfType, nodeVisitsOfType } from "./nodes-of-type.ts";

import type { ESTree } from "@oxlint/plugins";

describe("nodesOfType", () => {
  describe("a test block wrapping a call", () => {
    const it = test.extend("startsOfCalls", () =>
      nodesOfType(
        parseSync("spec.ts", 'it("names a behaviour", () => { runSut(); });').program
          .body[0] as ESTree.ExpressionStatement,
        "CallExpression",
      ).map((call) => call.start));

    it("hands back every call written under the node handed in", ({ startsOfCalls }) => {
      expect(startsOfCalls).toStrictEqual([0, 32]);
    });
  });

  describe("a call written inside another call", () => {
    const it = test.extend("startsOfCalls", () =>
      nodesOfType(
        parseSync("spec.ts", "outer(inner());").program.body[0] as ESTree.ExpressionStatement,
        "CallExpression",
      ).map((call) => call.start));

    it("hands back the call around it first", ({ startsOfCalls }) => {
      expect(startsOfCalls).toStrictEqual([0, 6]);
    });
  });

  describe("a node carrying the type asked for", () => {
    const it = test.extend("startsOfStatements", () =>
      nodesOfType(
        parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
        "ExpressionStatement",
      ).map((statement) => statement.start));

    it("hands back the node handed in", ({ startsOfStatements }) => {
      expect(startsOfStatements).toStrictEqual([0]);
    });
  });

  describe("a type written nowhere under the node", () => {
    const it = test.extend("startsOfDeclarations", () =>
      nodesOfType(
        parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
        "ClassDeclaration",
      ).map((declaration) => declaration.start));

    it("hands back nothing", ({ startsOfDeclarations }) => {
      expect(startsOfDeclarations).toStrictEqual([]);
    });
  });

  describe("a node holding a link back to the node around it", () => {
    const it = test.extend("startsOfCalls", () => {
      const statement = parseSync("spec.ts", "runSut();").program
        .body[0] as ESTree.ExpressionStatement;

      return nodesOfType({ ...statement, parent: statement }, "CallExpression").map(
        (call) => call.start,
      );
    });

    it("does not walk that link", ({ startsOfCalls }) => {
      expect(startsOfCalls).toStrictEqual([0]);
    });
  });
});

describe("nodeVisitsOfType", () => {
  describe("a call written inside a test block", () => {
    const it = test.extend("ancestorTypes", () =>
      nodeVisitsOfType(
        parseSync("spec.ts", 'it("names a behaviour", () => { runSut(); });').program
          .body[0] as ESTree.ExpressionStatement,
        "CallExpression",
      ).map((visit) => visit.ancestors.map((ancestor) => ancestor.type)));

    it("names every node standing between the root and the node found", ({ ancestorTypes }) => {
      expect(ancestorTypes).toStrictEqual([
        ["ExpressionStatement"],
        [
          "ExpressionStatement",
          "CallExpression",
          "ArrowFunctionExpression",
          "BlockStatement",
          "ExpressionStatement",
        ],
      ]);
    });
  });

  describe("a node reached through a field holding no node", () => {
    const it = test.extend("ancestorTypes", () =>
      nodeVisitsOfType(
        parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
        "CallExpression",
      ).map((visit) => visit.ancestors.map((ancestor) => ancestor.type)));

    it("still names the nodes standing above it", ({ ancestorTypes }) => {
      expect(ancestorTypes).toStrictEqual([["ExpressionStatement"]]);
    });
  });

  describe("a type written nowhere under the node", () => {
    const it = test.extend("visits", () =>
      nodeVisitsOfType(
        parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
        "ClassDeclaration",
      ));

    it("comes back as no visit at all", ({ visits }) => {
      expect(visits).toStrictEqual([]);
    });
  });

  describe("a node holding a link back to the node around it", () => {
    const it = test.extend("ancestorTypes", () => {
      const statement = parseSync("spec.ts", "runSut();").program
        .body[0] as ESTree.ExpressionStatement;

      return nodeVisitsOfType({ ...statement, parent: statement }, "CallExpression").map((visit) =>
        visit.ancestors.map((ancestor) => ancestor.type),
      );
    });

    it("does not walk that link for visits either", ({ ancestorTypes }) => {
      expect(ancestorTypes).toStrictEqual([["ExpressionStatement"]]);
    });
  });
});
