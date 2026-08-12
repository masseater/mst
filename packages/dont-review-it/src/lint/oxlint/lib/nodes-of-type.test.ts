import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodesOfType } from "./nodes-of-type.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("startsOfCallsInATestBlock", () =>
    nodesOfType(
      parseSync("spec.ts", 'it("names a behaviour", () => { runSut(); });').program
        .body[0] as ESTree.ExpressionStatement,
      "CallExpression",
    ).map((call) => call.start))
  .extend("startsOfNestedCalls", () =>
    nodesOfType(
      parseSync("spec.ts", "outer(inner());").program.body[0] as ESTree.ExpressionStatement,
      "CallExpression",
    ).map((call) => call.start),
  )
  .extend("startsOfExpressionStatementsInACallStatement", () =>
    nodesOfType(
      parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
      "ExpressionStatement",
    ).map((statement) => statement.start),
  )
  .extend("startsOfClassDeclarationsInACallStatement", () =>
    nodesOfType(
      parseSync("spec.ts", "runSut();").program.body[0] as ESTree.ExpressionStatement,
      "ClassDeclaration",
    ).map((declaration) => declaration.start),
  )
  .extend("startsOfCallsReachedFromANodeCarryingAParentLink", () => {
    const statement = parseSync("spec.ts", "runSut();").program
      .body[0] as ESTree.ExpressionStatement;

    return nodesOfType({ ...statement, parent: statement }, "CallExpression").map(
      (call) => call.start,
    );
  });

describe("nodes-of-type", () => {
  it("every call written under the node handed in comes back", ({ startsOfCallsInATestBlock }) => {
    expect(startsOfCallsInATestBlock).toStrictEqual([0, 32]);
  });

  it("a call comes back before the calls written inside it", ({ startsOfNestedCalls }) => {
    expect(startsOfNestedCalls).toStrictEqual([0, 6]);
  });

  it("the node handed in comes back when it carries the type asked for", ({
    startsOfExpressionStatementsInACallStatement,
  }) => {
    expect(startsOfExpressionStatementsInACallStatement).toStrictEqual([0]);
  });

  it("a type written nowhere under the node comes back as nothing", ({
    startsOfClassDeclarationsInACallStatement,
  }) => {
    expect(startsOfClassDeclarationsInACallStatement).toStrictEqual([]);
  });

  it("the link a node holds back to the node around it is not walked", ({
    startsOfCallsReachedFromANodeCarryingAParentLink,
  }) => {
    expect(startsOfCallsReachedFromANodeCarryingAParentLink).toStrictEqual([0]);
  });
});
