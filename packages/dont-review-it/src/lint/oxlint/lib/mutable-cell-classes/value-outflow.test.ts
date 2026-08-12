import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { nodeVisitsIn } from "./node-visits.ts";
import { flowsOutOf } from "./value-outflow.ts";

const it = test
  .extend("outflowOfANameStandingAsAParameter", () => {
    const found = nodeVisitsIn(
      parseSync("held.ts", "const bump = (held: number) => 1;").program,
    ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
    if (found === undefined) throw new Error("no held stands as a parameter of a function");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheBodyOfAFunction", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "const bump = () => held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands as the body of a function");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameOnTheLeftOfAnAssignment", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held = 1;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands on the left of an assignment");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameOnTheRightOfAnAssignment", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "sink.at = held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands on the right of an assignment");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameInsideAnObjectBoundToAName", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "const host = { at: held };").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held is written inside an object");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheValueOfAReturnedObject", () => {
    const found = nodeVisitsIn(
      parseSync("held.ts", "const walk = () => { return { at: held }; };").program,
    ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
    if (found === undefined) throw new Error("no held stands as the value of a returned object");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheTagOfATemplate", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held`text`;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands as the tag of a template");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheNameOfABinding", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "const held = 1;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands as the name of a binding");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheValueOfABinding", () => {
    const found = nodeVisitsIn(
      parseSync("held.ts", "const walk = () => { const alias = held; };").program,
    ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
    if (found === undefined) throw new Error("no held stands as the value of a binding");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheTestOfAReturnedCondition", () => {
    const found = nodeVisitsIn(
      parseSync("held.ts", "const walk = () => { return held ? 1 : 0; };").program,
    ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
    if (found === undefined) throw new Error("no held stands as the test of a returned condition");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameStandingAsTheTestOfAConditionGoingNowhere", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held ? 1 : 0;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands as the test of a condition");
    return flowsOutOf(found.node, found.ancestors);
  })
  .extend("outflowOfANameNothingCarriesAnywhere", () => {
    const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
      (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
    );
    if (found === undefined) throw new Error("no held stands on its own");
    return flowsOutOf(found.node, found.ancestors);
  });

describe("flowsOutOf", () => {
  it("a name standing as a parameter of a function stays where it is written", ({
    outflowOfANameStandingAsAParameter,
  }) => {
    expect(outflowOfANameStandingAsAParameter).toBe(false);
  });

  it("a name standing as the body of a function is handed out of it", ({
    outflowOfANameStandingAsTheBodyOfAFunction,
  }) => {
    expect(outflowOfANameStandingAsTheBodyOfAFunction).toBe(true);
  });

  it("a name standing on the left of an assignment stays where it is written", ({
    outflowOfANameOnTheLeftOfAnAssignment,
  }) => {
    expect(outflowOfANameOnTheLeftOfAnAssignment).toBe(false);
  });

  it("a name standing on the right of an assignment is handed out", ({
    outflowOfANameOnTheRightOfAnAssignment,
  }) => {
    expect(outflowOfANameOnTheRightOfAnAssignment).toBe(true);
  });

  it("a name written inside an object bound to a name is handed out", ({
    outflowOfANameInsideAnObjectBoundToAName,
  }) => {
    expect(outflowOfANameInsideAnObjectBoundToAName).toBe(true);
  });

  it("a name standing as the value of an object that is returned is handed out", ({
    outflowOfANameStandingAsTheValueOfAReturnedObject,
  }) => {
    expect(outflowOfANameStandingAsTheValueOfAReturnedObject).toBe(true);
  });

  it("a name standing as the tag of a template stays where it is written", ({
    outflowOfANameStandingAsTheTagOfATemplate,
  }) => {
    expect(outflowOfANameStandingAsTheTagOfATemplate).toBe(false);
  });

  it("a name standing as the name of a binding stays where it is written", ({
    outflowOfANameStandingAsTheNameOfABinding,
  }) => {
    expect(outflowOfANameStandingAsTheNameOfABinding).toBe(false);
  });

  it("a name standing as the value of a binding is handed out", ({
    outflowOfANameStandingAsTheValueOfABinding,
  }) => {
    expect(outflowOfANameStandingAsTheValueOfABinding).toBe(true);
  });

  it("a name standing as the test of a condition that is returned is handed out", ({
    outflowOfANameStandingAsTheTestOfAReturnedCondition,
  }) => {
    expect(outflowOfANameStandingAsTheTestOfAReturnedCondition).toBe(true);
  });

  it("a name standing as the test of a condition that goes nowhere stays where it is written", ({
    outflowOfANameStandingAsTheTestOfAConditionGoingNowhere,
  }) => {
    expect(outflowOfANameStandingAsTheTestOfAConditionGoingNowhere).toBe(false);
  });

  it("a name that nothing carries anywhere stays where it is written", ({
    outflowOfANameNothingCarriesAnywhere,
  }) => {
    expect(outflowOfANameNothingCarriesAnywhere).toBe(false);
  });
});
