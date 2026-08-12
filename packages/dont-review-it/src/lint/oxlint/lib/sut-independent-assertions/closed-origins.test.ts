import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { isSpecClosedValue } from "./closed-origins.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("verdictOnAWrittenOutString", () => {
    const written = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAWrittenOutBoolean", () => {
    const written = parseSync("spec.ts", "true;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAWrittenOutUndefined", () => {
    const written = parseSync("spec.ts", "undefined;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnASumOfWrittenOutNumbers", () => {
    const written = parseSync("spec.ts", "1 + 1;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAListOfWrittenOutStrings", () => {
    const written = parseSync("spec.ts", '["a", "b"];').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAShapeOfWrittenOutParts", () => {
    const written = parseSync("spec.ts", '({ id: "a", carried: [1] });').program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnATemplateWithoutSubstitution", () => {
    const written = parseSync("spec.ts", "`a`;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAChoiceBetweenWrittenOutStrings", () => {
    const written = parseSync("spec.ts", 'true ? "a" : "b";').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnANameFilledWithAWrittenOutValue", () => {
    const spelled = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      ["id", spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare],
    ]);
    const written = parseSync("spec.ts", "id;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameReachingAnotherName", () => {
    const relayed = parseSync("spec.ts", "id;").program.body[0] as ESTree.Statement;
    const relayedBare = (relayed as ESTree.ExpressionStatement).expression;
    const spelled = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "carried",
        relayedBare.type === "ParenthesizedExpression" ? relayedBare.expression : relayedBare,
      ],
      ["id", spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare],
    ]);
    const written = parseSync("spec.ts", "carried;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameTheSpecNeverFilled", () => {
    const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnANameDeclaredWithoutAValue", () => {
    const declared = new Map<string, ESTree.Expression | null>([["report", null]]);
    const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameReachingItself", () => {
    const spelled = parseSync("spec.ts", "looped;").program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "looped",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "looped;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnACallOfALocalName", () => {
    const written = parseSync("spec.ts", 'summarise("a");').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnACallOfANameFromOutsideTheSpec", () => {
    const written = parseSync("spec.ts", 'String("a");').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnATaggedTemplate", () => {
    const written = parseSync("spec.ts", "sql`a`;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAConstructionOnADeclaredName", () => {
    const declared = new Map<string, ESTree.Expression | null>([["Report", null]]);
    const written = parseSync("spec.ts", 'new Report("a");').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnAConstructionOnANameFromOutsideTheSpec", () => {
    const written = parseSync("spec.ts", 'new Headers({ accept: "text/plain" });').program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAConstructionCarryingAnOpenArgument", () => {
    const written = parseSync("spec.ts", "new Headers(sent);").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAWrittenOutStringBehindATypeAssertion", () => {
    const written = parseSync("spec.ts", '"a" as Spelling;').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnANameBehindANonNullAssertion", () => {
    const written = parseSync("spec.ts", "sent!;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAMemberOfAShapeWrittenOutOnTheSpot", () => {
    const written = parseSync("spec.ts", '({ id: "a" }).id;').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAnElementOfAListWrittenOutOnTheSpot", () => {
    const written = parseSync("spec.ts", '["a"][0];').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAMemberOfAnOpenName", () => {
    const written = parseSync("spec.ts", "report.id;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAMemberPickedByAnOpenKey", () => {
    const written = parseSync("spec.ts", '({ id: "a" })[picked];').program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnANameHoldingAShape", () => {
    const spelled = parseSync("spec.ts", "({});").program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "sink",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "sink;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameHoldingAList", () => {
    const spelled = parseSync("spec.ts", '["a"];').program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "ids",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "ids;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameHoldingAConstructedContainer", () => {
    const spelled = parseSync("spec.ts", "new Set();").program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "sink",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "sink;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnAMemberOfANameHoldingAConstructedContainer", () => {
    const spelled = parseSync("spec.ts", "new Set();").program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "sink",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "sink.size;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameHoldingJoinedStrings", () => {
    const spelled = parseSync("spec.ts", '"a" + "b";').program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "spelled",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "spelled;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnANameHoldingATemplate", () => {
    const spelled = parseSync("spec.ts", "`a`;").program.body[0] as ESTree.Statement;
    const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
    const declared = new Map<string, ESTree.Expression | null>([
      [
        "spelled",
        spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
      ],
    ]);
    const written = parseSync("spec.ts", "spelled;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: {
        boundValueOf: (reached) => declared.get(reached.name) ?? null,
        isDeclaredHere: (reached) => declared.has(reached.name),
      },
    });
  })
  .extend("verdictOnAFunctionWrittenInTheSpec", () => {
    const written = parseSync("spec.ts", '() => parse("");').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAShapeSpreadingAnOpenValue", () => {
    const written = parseSync("spec.ts", '({ ...report, id: "a" });').program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  })
  .extend("verdictOnAListSpreadingAnOpenValue", () => {
    const written = parseSync("spec.ts", '[...ids, "a"];').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    return isSpecClosedValue({
      written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
      reach: { boundValueOf: () => null, isDeclaredHere: () => false },
    });
  });

describe("isSpecClosedValue", () => {
  it("reads a written-out string as closed inside the spec", ({ verdictOnAWrittenOutString }) => {
    expect(verdictOnAWrittenOutString).toBe(true);
  });

  it("reads a written-out boolean as closed inside the spec", ({ verdictOnAWrittenOutBoolean }) => {
    expect(verdictOnAWrittenOutBoolean).toBe(true);
  });

  it("reads a written-out undefined as closed inside the spec", ({
    verdictOnAWrittenOutUndefined,
  }) => {
    expect(verdictOnAWrittenOutUndefined).toBe(true);
  });

  it("reads a sum of written-out numbers as closed", ({ verdictOnASumOfWrittenOutNumbers }) => {
    expect(verdictOnASumOfWrittenOutNumbers).toBe(true);
  });

  it("reads a list of written-out strings as closed", ({ verdictOnAListOfWrittenOutStrings }) => {
    expect(verdictOnAListOfWrittenOutStrings).toBe(true);
  });

  it("reads a shape whose parts are all written out as closed", ({
    verdictOnAShapeOfWrittenOutParts,
  }) => {
    expect(verdictOnAShapeOfWrittenOutParts).toBe(true);
  });

  it("reads a template that substitutes nothing as closed", ({
    verdictOnATemplateWithoutSubstitution,
  }) => {
    expect(verdictOnATemplateWithoutSubstitution).toBe(true);
  });

  it("reads a choice between written-out strings as closed", ({
    verdictOnAChoiceBetweenWrittenOutStrings,
  }) => {
    expect(verdictOnAChoiceBetweenWrittenOutStrings).toBe(true);
  });

  it("reads a name the spec filled with a written-out value as closed", ({
    verdictOnANameFilledWithAWrittenOutValue,
  }) => {
    expect(verdictOnANameFilledWithAWrittenOutValue).toBe(true);
  });

  it("follows a chain of names to the value at its end", ({
    verdictOnANameReachingAnotherName,
  }) => {
    expect(verdictOnANameReachingAnotherName).toBe(true);
  });

  it("reads a name whose value the spec never wrote as open", ({
    verdictOnANameTheSpecNeverFilled,
  }) => {
    expect(verdictOnANameTheSpecNeverFilled).toBe(false);
  });

  it("reads a name declared without a value the spec can read as open", ({
    verdictOnANameDeclaredWithoutAValue,
  }) => {
    expect(verdictOnANameDeclaredWithoutAValue).toBe(false);
  });

  it("stops at a name that reaches itself instead of walking forever", ({
    verdictOnANameReachingItself,
  }) => {
    expect(verdictOnANameReachingItself).toBe(false);
  });

  it("reads a call of a name the spec knows as open", ({ verdictOnACallOfALocalName }) => {
    expect(verdictOnACallOfALocalName).toBe(false);
  });

  it("reads a call of a name from outside the spec as open", ({
    verdictOnACallOfANameFromOutsideTheSpec,
  }) => {
    expect(verdictOnACallOfANameFromOutsideTheSpec).toBe(false);
  });

  it("reads a call written as a tagged template as open", ({ verdictOnATaggedTemplate }) => {
    expect(verdictOnATaggedTemplate).toBe(false);
  });

  it("reads a construction on a name this file declares as open", ({
    verdictOnAConstructionOnADeclaredName,
  }) => {
    expect(verdictOnAConstructionOnADeclaredName).toBe(false);
  });

  it("reads a construction on a name from outside the spec as closed", ({
    verdictOnAConstructionOnANameFromOutsideTheSpec,
  }) => {
    expect(verdictOnAConstructionOnANameFromOutsideTheSpec).toBe(true);
  });

  it("reads a construction carrying an open argument as open", ({
    verdictOnAConstructionCarryingAnOpenArgument,
  }) => {
    expect(verdictOnAConstructionCarryingAnOpenArgument).toBe(false);
  });

  it("reads a written-out value carried through a type assertion as closed", ({
    verdictOnAWrittenOutStringBehindATypeAssertion,
  }) => {
    expect(verdictOnAWrittenOutStringBehindATypeAssertion).toBe(true);
  });

  it("reads an open name carried through a non-null assertion as open", ({
    verdictOnANameBehindANonNullAssertion,
  }) => {
    expect(verdictOnANameBehindANonNullAssertion).toBe(false);
  });

  it("reads a member of a shape written out on the spot as closed", ({
    verdictOnAMemberOfAShapeWrittenOutOnTheSpot,
  }) => {
    expect(verdictOnAMemberOfAShapeWrittenOutOnTheSpot).toBe(true);
  });

  it("reads an element of a list written out on the spot as closed", ({
    verdictOnAnElementOfAListWrittenOutOnTheSpot,
  }) => {
    expect(verdictOnAnElementOfAListWrittenOutOnTheSpot).toBe(true);
  });

  it("reads a member of an open value as open", ({ verdictOnAMemberOfAnOpenName }) => {
    expect(verdictOnAMemberOfAnOpenName).toBe(false);
  });

  it("reads a member picked by an open key as open", ({ verdictOnAMemberPickedByAnOpenKey }) => {
    expect(verdictOnAMemberPickedByAnOpenKey).toBe(false);
  });

  it("reads a shape a name holds as open, since anything holding it can write into it", ({
    verdictOnANameHoldingAShape,
  }) => {
    expect(verdictOnANameHoldingAShape).toBe(false);
  });

  it("reads a list a name holds as open, since anything holding it can write into it", ({
    verdictOnANameHoldingAList,
  }) => {
    expect(verdictOnANameHoldingAList).toBe(false);
  });

  it("reads a constructed container a name holds as open", ({
    verdictOnANameHoldingAConstructedContainer,
  }) => {
    expect(verdictOnANameHoldingAConstructedContainer).toBe(false);
  });

  it("reads a member of a constructed container a name holds as open", ({
    verdictOnAMemberOfANameHoldingAConstructedContainer,
  }) => {
    expect(verdictOnAMemberOfANameHoldingAConstructedContainer).toBe(false);
  });

  it("reads joined strings a name holds as closed, since nothing can write into them", ({
    verdictOnANameHoldingJoinedStrings,
  }) => {
    expect(verdictOnANameHoldingJoinedStrings).toBe(true);
  });

  it("reads a template a name holds as closed, since nothing can write into it", ({
    verdictOnANameHoldingATemplate,
  }) => {
    expect(verdictOnANameHoldingATemplate).toBe(true);
  });

  it("reads a function written in the spec as open", ({ verdictOnAFunctionWrittenInTheSpec }) => {
    expect(verdictOnAFunctionWrittenInTheSpec).toBe(false);
  });

  it("reads a shape spreading an open value as open", ({ verdictOnAShapeSpreadingAnOpenValue }) => {
    expect(verdictOnAShapeSpreadingAnOpenValue).toBe(false);
  });

  it("reads a list spreading an open value as open", ({ verdictOnAListSpreadingAnOpenValue }) => {
    expect(verdictOnAListSpreadingAnOpenValue).toBe(false);
  });
});
