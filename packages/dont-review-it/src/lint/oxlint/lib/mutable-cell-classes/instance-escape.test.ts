import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { FUNCTION_NODE_TYPES } from "../node-kinds.ts";
import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { constructedValueEscapes } from "./instance-escape.ts";
import { innermostOf, nodeVisitsIn } from "./node-visits.ts";

const SCOPE_OPENING = "class Cell {}\nconst walk = () => {\n";

const SCOPE_CLOSING = "\n};\n";

const it = test
  .extend("escapeOfAnInstanceTakenApartOnTheWayOut", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const { total } = new Cell();\nreturn total;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldInABindingAndOnlyRead", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}const held = new Cell();\nheld.mark();${SCOPE_CLOSING}`)
        .program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceReturnedFromItsScope", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}const held = new Cell();\nreturn held;${SCOPE_CLOSING}`)
        .program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceThrownOutOfItsScope", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}const held = new Cell();\nthrow held;${SCOPE_CLOSING}`)
        .program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHandedToACall", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}const held = new Cell();\nsink(held);${SCOPE_CLOSING}`)
        .program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceSpreadIntoACall", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nsink(...[held]);${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHandedToATemplateTag", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\ntag\`\${held}\`;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHandedToAFurtherConstruction", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst wrap = new Wrapper(held);${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceWrittenOntoSomethingElse", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nsink.at = held;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceBoundToASecondName", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst alias = held;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstancePackedIntoAReturnedObject", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nreturn { held };${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceChosenByAConditionAndReturned", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nreturn ready ? held : null;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceWeighedByAReturnedCondition", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nreturn held ? 1 : 0;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceReadThroughAnAssertion", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\n(held as Cell).mark();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceReturnedThroughAnAssertion", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nreturn held as Cell;${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceReadThroughAnOptionalLink", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nheld?.mark();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceBuiltStraightIntoAReturn", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}return new Cell();${SCOPE_CLOSING}`).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceBuiltAndReadInPlace", () => {
    const visits = nodeVisitsIn(
      parseSync("cell.ts", `${SCOPE_OPENING}new Cell().mark();${SCOPE_CLOSING}`).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByALocalFunctionThatIsOnlyCalled", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst bump = () => held.mark();\nbump();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByALocalFunctionDeclarationThatIsOnlyCalled", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nfunction bump() { held.mark(); }\nbump();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByALocalFunctionThatIsHandedAway", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst bump = () => held.mark();\nregister(bump);${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByANamelessFunctionHandedAway", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nregister(() => held.mark());${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHandedOutFromInsideALocalFunction", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst send = () => register(held);\nsend();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByAFunctionInsideAFunctionThatIsOnlyCalled", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { const inner = () => held.mark(); inner(); };\nouter();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByANamelessFunctionInsideAFunctionHandedAway", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { register(() => held.mark()); };\nouter();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByTwoFunctionsThatCallEachOther", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst even = () => odd();\nconst odd = () => { held.mark(); even(); };\nodd();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceHeldByAFunctionRunningInPlaceInsideAFunction", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { (() => held.mark())(); };\nouter();${SCOPE_CLOSING}`,
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceYieldedOutOfItsScope", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        "class Cell {}\nfunction* walk() { const held = new Cell(); yield held; }",
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  })
  .extend("escapeOfAnInstanceWhoseNameIsAlsoBoundOutsideItsScope", () => {
    const visits = nodeVisitsIn(
      parseSync(
        "cell.ts",
        "class Cell {}\nconst held = 0;\nconst walk = () => { const held = new Cell(); held.mark(); };",
      ).program,
    );
    const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
    if (built === undefined) throw new Error("the source builds nothing");
    const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
    if (scope === null) throw new Error("no function holds the construction");
    return constructedValueEscapes({ visits, scope }, built);
  });

describe("constructedValueEscapes", () => {
  it("an instance taken apart on the way out of its scope leaves it", ({
    escapeOfAnInstanceTakenApartOnTheWayOut,
  }) => {
    expect(escapeOfAnInstanceTakenApartOnTheWayOut).toBe(true);
  });

  it("an instance held in a binding and only read stays inside its scope", ({
    escapeOfAnInstanceHeldInABindingAndOnlyRead,
  }) => {
    expect(escapeOfAnInstanceHeldInABindingAndOnlyRead).toBe(false);
  });

  it("an instance returned from its scope leaves it", ({
    escapeOfAnInstanceReturnedFromItsScope,
  }) => {
    expect(escapeOfAnInstanceReturnedFromItsScope).toBe(true);
  });

  it("an instance thrown out of its scope leaves it", ({
    escapeOfAnInstanceThrownOutOfItsScope,
  }) => {
    expect(escapeOfAnInstanceThrownOutOfItsScope).toBe(true);
  });

  it("an instance handed to a call leaves its scope", ({ escapeOfAnInstanceHandedToACall }) => {
    expect(escapeOfAnInstanceHandedToACall).toBe(true);
  });

  it("an instance spread into a call leaves its scope", ({ escapeOfAnInstanceSpreadIntoACall }) => {
    expect(escapeOfAnInstanceSpreadIntoACall).toBe(true);
  });

  it("an instance handed to a template tag leaves its scope", ({
    escapeOfAnInstanceHandedToATemplateTag,
  }) => {
    expect(escapeOfAnInstanceHandedToATemplateTag).toBe(true);
  });

  it("an instance handed to a further construction leaves its scope", ({
    escapeOfAnInstanceHandedToAFurtherConstruction,
  }) => {
    expect(escapeOfAnInstanceHandedToAFurtherConstruction).toBe(true);
  });

  it("an instance written onto something else leaves its scope", ({
    escapeOfAnInstanceWrittenOntoSomethingElse,
  }) => {
    expect(escapeOfAnInstanceWrittenOntoSomethingElse).toBe(true);
  });

  it("an instance bound to a second name leaves its scope", ({
    escapeOfAnInstanceBoundToASecondName,
  }) => {
    expect(escapeOfAnInstanceBoundToASecondName).toBe(true);
  });

  it("an instance packed into an object that is returned leaves its scope", ({
    escapeOfAnInstancePackedIntoAReturnedObject,
  }) => {
    expect(escapeOfAnInstancePackedIntoAReturnedObject).toBe(true);
  });

  it("an instance chosen by a condition and returned leaves its scope", ({
    escapeOfAnInstanceChosenByAConditionAndReturned,
  }) => {
    expect(escapeOfAnInstanceChosenByAConditionAndReturned).toBe(true);
  });

  it("an instance weighed by a condition that is returned leaves its scope", ({
    escapeOfAnInstanceWeighedByAReturnedCondition,
  }) => {
    expect(escapeOfAnInstanceWeighedByAReturnedCondition).toBe(true);
  });

  it("an instance read through an assertion stays inside its scope", ({
    escapeOfAnInstanceReadThroughAnAssertion,
  }) => {
    expect(escapeOfAnInstanceReadThroughAnAssertion).toBe(false);
  });

  it("an instance returned through an assertion leaves its scope", ({
    escapeOfAnInstanceReturnedThroughAnAssertion,
  }) => {
    expect(escapeOfAnInstanceReturnedThroughAnAssertion).toBe(true);
  });

  it("an instance read through an optional link stays inside its scope", ({
    escapeOfAnInstanceReadThroughAnOptionalLink,
  }) => {
    expect(escapeOfAnInstanceReadThroughAnOptionalLink).toBe(false);
  });

  it("an instance built straight into a return leaves its scope", ({
    escapeOfAnInstanceBuiltStraightIntoAReturn,
  }) => {
    expect(escapeOfAnInstanceBuiltStraightIntoAReturn).toBe(true);
  });

  it("an instance built and read in place stays inside its scope", ({
    escapeOfAnInstanceBuiltAndReadInPlace,
  }) => {
    expect(escapeOfAnInstanceBuiltAndReadInPlace).toBe(false);
  });

  it("an instance held by a local function that is only called stays inside its scope", ({
    escapeOfAnInstanceHeldByALocalFunctionThatIsOnlyCalled,
  }) => {
    expect(escapeOfAnInstanceHeldByALocalFunctionThatIsOnlyCalled).toBe(false);
  });

  it("an instance held by a local function declaration that is only called stays inside its scope", ({
    escapeOfAnInstanceHeldByALocalFunctionDeclarationThatIsOnlyCalled,
  }) => {
    expect(escapeOfAnInstanceHeldByALocalFunctionDeclarationThatIsOnlyCalled).toBe(false);
  });

  it("an instance held by a local function that is handed away leaves its scope", ({
    escapeOfAnInstanceHeldByALocalFunctionThatIsHandedAway,
  }) => {
    expect(escapeOfAnInstanceHeldByALocalFunctionThatIsHandedAway).toBe(true);
  });

  it("an instance held by a nameless function handed away leaves its scope", ({
    escapeOfAnInstanceHeldByANamelessFunctionHandedAway,
  }) => {
    expect(escapeOfAnInstanceHeldByANamelessFunctionHandedAway).toBe(true);
  });

  it("an instance handed out from inside a local function leaves its scope", ({
    escapeOfAnInstanceHandedOutFromInsideALocalFunction,
  }) => {
    expect(escapeOfAnInstanceHandedOutFromInsideALocalFunction).toBe(true);
  });

  it("an instance held by a function inside a function that is only called stays inside its scope", ({
    escapeOfAnInstanceHeldByAFunctionInsideAFunctionThatIsOnlyCalled,
  }) => {
    expect(escapeOfAnInstanceHeldByAFunctionInsideAFunctionThatIsOnlyCalled).toBe(false);
  });

  it("an instance held by a nameless function inside a function that is handed away leaves its scope", ({
    escapeOfAnInstanceHeldByANamelessFunctionInsideAFunctionHandedAway,
  }) => {
    expect(escapeOfAnInstanceHeldByANamelessFunctionInsideAFunctionHandedAway).toBe(true);
  });

  it("an instance held by two functions that call each other stays inside its scope", ({
    escapeOfAnInstanceHeldByTwoFunctionsThatCallEachOther,
  }) => {
    expect(escapeOfAnInstanceHeldByTwoFunctionsThatCallEachOther).toBe(false);
  });

  it("an instance held by a function running in place inside a function stays inside its scope", ({
    escapeOfAnInstanceHeldByAFunctionRunningInPlaceInsideAFunction,
  }) => {
    expect(escapeOfAnInstanceHeldByAFunctionRunningInPlaceInsideAFunction).toBe(false);
  });

  it("an instance yielded out of its scope leaves it", ({
    escapeOfAnInstanceYieldedOutOfItsScope,
  }) => {
    expect(escapeOfAnInstanceYieldedOutOfItsScope).toBe(true);
  });

  it("an instance whose name is also bound outside its scope stays inside its scope", ({
    escapeOfAnInstanceWhoseNameIsAlsoBoundOutsideItsScope,
  }) => {
    expect(escapeOfAnInstanceWhoseNameIsAlsoBoundOutsideItsScope).toBe(false);
  });
});
