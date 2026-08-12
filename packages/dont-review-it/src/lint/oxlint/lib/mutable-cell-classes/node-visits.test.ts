import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { chainFrom, fieldOf, innermostOf, kindAt, nodeVisitsIn, visitAt } from "./node-visits.ts";

import type { AstFields } from "../ast-node.ts";

const ELSEWHERE: AstFields = { type: "Program" };

const it = test
  .extend("kindsWalkedInASourceHoldingAType", () =>
    nodeVisitsIn(parseSync("held.ts", "const held: Cell = read();").program).map((visit) =>
      nodeTypeOf(visit.node),
    ))
  .extend("kindsWalkedInASourceHoldingAValue", () =>
    nodeVisitsIn(parseSync("held.ts", "held;").program).map((visit) => nodeTypeOf(visit.node)),
  )
  .extend("ancestorKindsCarriedByAWalkedName", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    return found.ancestors.map(nodeTypeOf);
  })
  .extend("fieldReadOffAWalkedNode", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    return fieldOf(found.node, "name");
  })
  .extend("fieldReadOffSomethingThatIsNoNode", () => fieldOf("held", "name"))
  .extend("kindOfAWalkedNode", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    return kindAt(found.node);
  })
  .extend("kindOfSomethingThatIsNoNode", () => kindAt(null))
  .extend("chainKindsCutAtANodeItSitsUnder", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    const [boundary] = found.ancestors.slice(-1);
    if (boundary === undefined) throw new Error("held sits under nothing");
    return chainFrom(found, boundary).map(nodeTypeOf);
  })
  .extend("chainKindsCutAtANodeItDoesNotSitUnder", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    return chainFrom(found, ELSEWHERE).map(nodeTypeOf);
  })
  .extend("ancestorKindsOfTheVisitAtANodeItSitsUnder", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    const [boundary] = found.ancestors.slice(-1);
    if (boundary === undefined) throw new Error("held sits under nothing");
    return visitAt(found, boundary).ancestors.map(nodeTypeOf);
  })
  .extend("kindOfTheNearestWantedAncestor", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "const walk = () => held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands as the body of a function");
    return nodeTypeOf(
      innermostOf(found.ancestors, new Set(["ArrowFunctionExpression"])) ?? ELSEWHERE,
    );
  })
  .extend("nearestWantedAncestorOfAChainHoldingNone", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written on its own");
    return innermostOf(found.ancestors, new Set(["ClassBody"]));
  });

describe("nodeVisitsIn", () => {
  it("a name written in a type is left out of the walk", ({ kindsWalkedInASourceHoldingAType }) => {
    expect(kindsWalkedInASourceHoldingAType).toStrictEqual([
      "Program",
      "VariableDeclaration",
      "VariableDeclarator",
      "Identifier",
      "CallExpression",
      "Identifier",
    ]);
  });

  it("a name written in a value is walked", ({ kindsWalkedInASourceHoldingAValue }) => {
    expect(kindsWalkedInASourceHoldingAValue).toStrictEqual([
      "Program",
      "ExpressionStatement",
      "Identifier",
    ]);
  });

  it("a walked node carries the nodes it sits under", ({ ancestorKindsCarriedByAWalkedName }) => {
    expect(ancestorKindsCarriedByAWalkedName).toStrictEqual(["Program", "ExpressionStatement"]);
  });
});

describe("fieldOf", () => {
  it("a field of a node is read", ({ fieldReadOffAWalkedNode }) => {
    expect(fieldReadOffAWalkedNode).toBe("held");
  });

  it("a field of something that is no node reads as nothing", ({
    fieldReadOffSomethingThatIsNoNode,
  }) => {
    expect(fieldReadOffSomethingThatIsNoNode).toBe(undefined);
  });
});

describe("kindAt", () => {
  it("a node reads as its own kind", ({ kindOfAWalkedNode }) => {
    expect(kindOfAWalkedNode).toBe("Identifier");
  });

  it("something that is no node reads as no kind", ({ kindOfSomethingThatIsNoNode }) => {
    expect(kindOfSomethingThatIsNoNode).toBe("");
  });
});

describe("chainFrom", () => {
  it("a chain cut at a node it sits under starts at that node", ({
    chainKindsCutAtANodeItSitsUnder,
  }) => {
    expect(chainKindsCutAtANodeItSitsUnder).toStrictEqual(["ExpressionStatement"]);
  });

  it("a chain cut at a node it does not sit under keeps every node", ({
    chainKindsCutAtANodeItDoesNotSitUnder,
  }) => {
    expect(chainKindsCutAtANodeItDoesNotSitUnder).toStrictEqual(["Program", "ExpressionStatement"]);
  });
});

describe("visitAt", () => {
  it("a node this one sits under is carried with the nodes above it", ({
    ancestorKindsOfTheVisitAtANodeItSitsUnder,
  }) => {
    expect(ancestorKindsOfTheVisitAtANodeItSitsUnder).toStrictEqual(["Program"]);
  });
});

describe("innermostOf", () => {
  it("the nearest node of a wanted kind is picked", ({ kindOfTheNearestWantedAncestor }) => {
    expect(kindOfTheNearestWantedAncestor).toBe("ArrowFunctionExpression");
  });

  it("a chain holding no wanted kind picks nothing", ({
    nearestWantedAncestorOfAChainHoldingNone,
  }) => {
    expect(nearestWantedAncestorOfAChainHoldingNone).toBe(null);
  });
});
