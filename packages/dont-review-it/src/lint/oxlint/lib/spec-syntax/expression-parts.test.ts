import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedValues, partsOf } from "./expression-parts.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("typesHandedOverByACallOnAMember", () => {
    const statement = parseSync("spec.ts", "summarise(input).sort(order);").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByACallOnABareName", () => {
    const statement = parseSync("spec.ts", "summarise(input);").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAConstruction", () => {
    const statement = parseSync("spec.ts", "new Report(input);").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByADottedMemberAccess", () => {
    const statement = parseSync("spec.ts", "summarise(input).rows;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByASubscriptedMemberAccess", () => {
    const statement = parseSync("spec.ts", "summarise(input)[key];").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByATaggedTemplate", () => {
    const statement = parseSync("spec.ts", "sql`${input}`;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByATemplate", () => {
    const statement = parseSync("spec.ts", "`${input}`;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByACollection", () => {
    const statement = parseSync("spec.ts", "[, input, ...rest];").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAnObject", () => {
    const statement = parseSync("spec.ts", "({ rows: input, ...rest });").program
      .body[0] as ESTree.ExpressionStatement;
    const bare = statement.expression;
    const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return partsOf(written).map((part) => part.type);
  })
  .extend("typesHandedOverByAChoice", () => {
    const statement = parseSync("spec.ts", "empty ? left : right;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAComparison", () => {
    const statement = parseSync("spec.ts", "left + right;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAComparisonAgainstAPrivateName", () => {
    const declared = parseSync(
      "spec.ts",
      "class Reports {\n  #brand;\n  held = #brand in input;\n}",
    ).program.body[0] as ESTree.Class;
    const written = declared.body.body[1] as ESTree.PropertyDefinition;
    return partsOf(written.value as ESTree.Expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAFallback", () => {
    const statement = parseSync("spec.ts", "cached ?? produced;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByASequence", () => {
    const statement = parseSync("spec.ts", "(record(), produced);").program
      .body[0] as ESTree.ExpressionStatement;
    const bare = statement.expression;
    const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return partsOf(written).map((part) => part.type);
  })
  .extend("typesHandedOverByAnOperatorAppliedToOneValue", () => {
    const statement = parseSync("spec.ts", "-produced;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAnAssignment", () => {
    const statement = parseSync("spec.ts", "(carried = produced);").program
      .body[0] as ESTree.ExpressionStatement;
    const bare = statement.expression;
    const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return partsOf(written).map((part) => part.type);
  })
  .extend("typesHandedOverByAPairOfParentheses", () => {
    const statement = parseSync("spec.ts", "(produced);").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByAStringWrittenOut", () => {
    const statement = parseSync("spec.ts", '"a";').program.body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("typesHandedOverByABareName", () => {
    const statement = parseSync("spec.ts", "produced;").program
      .body[0] as ESTree.ExpressionStatement;
    return partsOf(statement.expression).map((part) => part.type);
  })
  .extend("valuesHandedOverByAnEmptyList", () => handedValues([]));

describe("expression parts", () => {
  it("a call hands over its receiver and its arguments", ({ typesHandedOverByACallOnAMember }) => {
    expect(typesHandedOverByACallOnAMember).toStrictEqual(["CallExpression", "Identifier"]);
  });

  it("a call on a bare name hands over its arguments alone", ({
    typesHandedOverByACallOnABareName,
  }) => {
    expect(typesHandedOverByACallOnABareName).toStrictEqual(["Identifier"]);
  });

  it("a construction hands over its arguments", ({ typesHandedOverByAConstruction }) => {
    expect(typesHandedOverByAConstruction).toStrictEqual(["Identifier"]);
  });

  it("a member access written with a dot hands over what it reads through", ({
    typesHandedOverByADottedMemberAccess,
  }) => {
    expect(typesHandedOverByADottedMemberAccess).toStrictEqual(["CallExpression"]);
  });

  it("a member access written as a subscript hands over what it reads through", ({
    typesHandedOverByASubscriptedMemberAccess,
  }) => {
    expect(typesHandedOverByASubscriptedMemberAccess).toStrictEqual(["CallExpression"]);
  });

  it("a tagged template hands over its tag and its substitutions", ({
    typesHandedOverByATaggedTemplate,
  }) => {
    expect(typesHandedOverByATaggedTemplate).toStrictEqual(["Identifier", "Identifier"]);
  });

  it("a template hands over its substitutions", ({ typesHandedOverByATemplate }) => {
    expect(typesHandedOverByATemplate).toStrictEqual(["Identifier"]);
  });

  it("a collection hands over its elements, spreads included and holes dropped", ({
    typesHandedOverByACollection,
  }) => {
    expect(typesHandedOverByACollection).toStrictEqual(["Identifier", "Identifier"]);
  });

  it("an object hands over its values, spreads included", ({ typesHandedOverByAnObject }) => {
    expect(typesHandedOverByAnObject).toStrictEqual(["Identifier", "Identifier"]);
  });

  it("a choice hands over the question and both answers", ({ typesHandedOverByAChoice }) => {
    expect(typesHandedOverByAChoice).toStrictEqual(["Identifier", "Identifier", "Identifier"]);
  });

  it("a comparison hands over both sides", ({ typesHandedOverByAComparison }) => {
    expect(typesHandedOverByAComparison).toStrictEqual(["Identifier", "Identifier"]);
  });

  it("a comparison against a private name hands over the side that holds a value", ({
    typesHandedOverByAComparisonAgainstAPrivateName,
  }) => {
    expect(typesHandedOverByAComparisonAgainstAPrivateName).toStrictEqual(["Identifier"]);
  });

  it("a fallback hands over both sides", ({ typesHandedOverByAFallback }) => {
    expect(typesHandedOverByAFallback).toStrictEqual(["Identifier", "Identifier"]);
  });

  it("a sequence hands over every step", ({ typesHandedOverByASequence }) => {
    expect(typesHandedOverByASequence).toStrictEqual(["CallExpression", "Identifier"]);
  });

  it("an operator applied to one value hands that value over", ({
    typesHandedOverByAnOperatorAppliedToOneValue,
  }) => {
    expect(typesHandedOverByAnOperatorAppliedToOneValue).toStrictEqual(["Identifier"]);
  });

  it("an assignment hands over what is being written", ({ typesHandedOverByAnAssignment }) => {
    expect(typesHandedOverByAnAssignment).toStrictEqual(["Identifier"]);
  });

  it("a pair of parentheses hands over what it wraps", ({
    typesHandedOverByAPairOfParentheses,
  }) => {
    expect(typesHandedOverByAPairOfParentheses).toStrictEqual(["Identifier"]);
  });

  it("a string written out carries nothing further and hands over nothing", ({
    typesHandedOverByAStringWrittenOut,
  }) => {
    expect(typesHandedOverByAStringWrittenOut).toStrictEqual([]);
  });

  it("a bare name carries nothing further and hands over nothing", ({
    typesHandedOverByABareName,
  }) => {
    expect(typesHandedOverByABareName).toStrictEqual([]);
  });

  it("a list of handed values drops holes and unwraps spreads", ({
    valuesHandedOverByAnEmptyList,
  }) => {
    expect(valuesHandedOverByAnEmptyList).toStrictEqual([]);
  });
});
