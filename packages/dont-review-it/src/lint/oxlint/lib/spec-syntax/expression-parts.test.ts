import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedValues, partsOf } from "./expression-parts.ts";

import type { ESTree } from "@oxlint/plugins";

const writtenIn = (source: string): ESTree.Expression => {
  const statement = parseSync("spec.ts", `${source};`).program.body[0] as ESTree.Statement;
  return (statement as ESTree.ExpressionStatement).expression;
};

const expressionIn = (source: string): ESTree.Expression => {
  const written = writtenIn(source);
  return written.type === "ParenthesizedExpression" ? written.expression : written;
};

const spellingsIn = (source: string): readonly string[] =>
  partsOf(expressionIn(source)).map((part) => part.type);

describe("expression parts", () => {
  test("a call hands over its receiver and its arguments", () => {
    expect(spellingsIn("summarise(input).sort(order)")).toStrictEqual([
      "CallExpression",
      "Identifier",
    ]);
  });

  test("a call on a bare name hands over its arguments alone", () => {
    expect(spellingsIn("summarise(input)")).toStrictEqual(["Identifier"]);
  });

  test("a construction hands over its arguments", () => {
    expect(spellingsIn("new Report(input)")).toStrictEqual(["Identifier"]);
  });

  test("a member access hands over what it reads through", () => {
    expect(spellingsIn("summarise(input).rows")).toStrictEqual(["CallExpression"]);
    expect(spellingsIn("summarise(input)[key]")).toStrictEqual(["CallExpression"]);
  });

  test("a tagged template hands over its tag and its substitutions", () => {
    expect(spellingsIn("sql`${input}`")).toStrictEqual(["Identifier", "Identifier"]);
  });

  test("a template hands over its substitutions", () => {
    expect(spellingsIn("`${input}`")).toStrictEqual(["Identifier"]);
  });

  test("a collection hands over its elements, spreads included and holes dropped", () => {
    expect(spellingsIn("[, input, ...rest]")).toStrictEqual(["Identifier", "Identifier"]);
  });

  test("an object hands over its values, spreads included", () => {
    expect(spellingsIn("({ rows: input, ...rest })")).toStrictEqual(["Identifier", "Identifier"]);
  });

  test("a choice hands over the question and both answers", () => {
    expect(spellingsIn("empty ? left : right")).toStrictEqual([
      "Identifier",
      "Identifier",
      "Identifier",
    ]);
  });

  test("a comparison hands over both sides", () => {
    expect(spellingsIn("left + right")).toStrictEqual(["Identifier", "Identifier"]);
  });

  test("a comparison against a private name hands over the side that holds a value", () => {
    const held = parseSync("spec.ts", "class Reports {\n  #brand;\n  held = #brand in input;\n}")
      .program.body[0] as ESTree.Statement;
    const declared = (held as ESTree.Class).body.body[1] as ESTree.PropertyDefinition;

    expect(partsOf(declared.value as ESTree.Expression).map((part) => part.type)).toStrictEqual([
      "Identifier",
    ]);
  });

  test("a fallback hands over both sides", () => {
    expect(spellingsIn("cached ?? produced")).toStrictEqual(["Identifier", "Identifier"]);
  });

  test("a sequence hands over every step", () => {
    expect(spellingsIn("(record(), produced)")).toStrictEqual(["CallExpression", "Identifier"]);
  });

  test("an operator applied to one value hands that value over", () => {
    expect(spellingsIn("-produced")).toStrictEqual(["Identifier"]);
  });

  test("an assignment hands over what is being written", () => {
    expect(spellingsIn("(carried = produced)")).toStrictEqual(["Identifier"]);
  });

  test("a pair of parentheses hands over what it wraps", () => {
    expect(partsOf(writtenIn("(produced)")).map((part) => part.type)).toStrictEqual(["Identifier"]);
  });

  test("a value that carries nothing further hands over nothing", () => {
    expect(spellingsIn('"a"')).toStrictEqual([]);
    expect(spellingsIn("produced")).toStrictEqual([]);
  });

  test("a list of handed values drops holes and unwraps spreads", () => {
    expect(handedValues([])).toStrictEqual([]);
  });
});
