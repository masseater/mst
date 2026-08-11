import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { comparedPositionsOf, isSettledShape, type ComparedSide } from "./compared-positions.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionIn = (source: string): ESTree.Expression => {
  const declared = parseSync("spec.ts", `const written = ${source};`).program
    .body[0] as ESTree.Statement;
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  return declarator?.init as ESTree.Expression;
};

const identity = (node: ESTree.Expression): ESTree.Expression => node;

const spellingOf = (side: ComparedSide): string => (side === null ? "none" : side.type);

const positionsBetween = (left: string | null, right: string | null): readonly string[] =>
  comparedPositionsOf({
    left: left === null ? null : expressionIn(left),
    right: right === null ? null : expressionIn(right),
    resolve: identity,
  }).map((pair) => `${spellingOf(pair.left)}/${spellingOf(pair.right)}`);
describe("compared-positions", () => {
  test("two values that are not containers line up as one pair", () => {
    expect(positionsBetween("subject", "new Response('a')")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("an absent side still lines up as a pair, with nothing on that side", () => {
    expect(positionsBetween("new Response('a')", null)).toStrictEqual(["NewExpression/none"]);
    expect(positionsBetween(null, "new Response('a')")).toStrictEqual(["none/NewExpression"]);
  });

  test("two objects line up key by key", () => {
    expect(
      positionsBetween("{ a: subject, b: 1 }", "{ b: 2, a: new Response('a') }"),
    ).toStrictEqual(["Identifier/NewExpression", "Literal/Literal"]);
  });

  test("a key written as a number lines up with the same key written as text", () => {
    expect(positionsBetween("{ 1: subject }", "{ '1': new Response('a') }")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("a key reached through a template without substitutions is the same key", () => {
    expect(positionsBetween("{ [`a`]: subject }", "{ a: new Response('a') }")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("key sets that differ leave the outer comparison to fall on its own", () => {
    expect(positionsBetween("{ a: subject }", "{ b: subject }")).toStrictEqual([]);
    expect(positionsBetween("{ a: subject }", "{ a: subject, b: subject }")).toStrictEqual([]);
  });

  test("a spread leaves the corresponding positions undecided on either side", () => {
    expect(positionsBetween("{ ...rest }", "{ a: subject }")).toStrictEqual([]);
    expect(positionsBetween("{ a: subject }", "{ ...rest }")).toStrictEqual([]);
  });

  test("a key decided at run time leaves the corresponding positions undecided", () => {
    expect(positionsBetween("{ [field]: subject }", "{ a: subject }")).toStrictEqual([]);
  });

  test("a duplicated key keeps the value written last, the way the language does", () => {
    expect(positionsBetween("{ a: 1, a: subject }", "{ a: new Response('a') }")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("an object standing against a settled shape leaves the comparison to fall", () => {
    expect(positionsBetween("{ a: subject }", "'ok'")).toStrictEqual([]);
    expect(positionsBetween("{ a: subject }", "[subject]")).toStrictEqual([]);
  });

  test("an object standing against a value nothing is known about keeps its positions open", () => {
    expect(positionsBetween("{ a: new Response('a') }", "subject")).toStrictEqual([
      "NewExpression/none",
    ]);
    expect(positionsBetween("subject", "{ a: new Response('a') }")).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  test("two arrays line up index by index", () => {
    expect(positionsBetween("[subject, 1]", "[new Response('a'), 2]")).toStrictEqual([
      "Identifier/NewExpression",
      "Literal/Literal",
    ]);
  });

  test("lengths that differ leave the outer comparison to fall on its own", () => {
    expect(positionsBetween("[subject]", "[subject, subject]")).toStrictEqual([]);
  });

  test("a hole standing against a written element is a difference in shape", () => {
    expect(positionsBetween("[, subject]", "[subject, subject]")).toStrictEqual([]);
  });

  test("holes on both sides line up, and nothing is compared at that index", () => {
    expect(positionsBetween("[, subject]", "[, new Response('a')]")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("a spread in an array leaves the corresponding positions undecided", () => {
    expect(positionsBetween("[...rest]", "[subject]")).toStrictEqual([]);
    expect(positionsBetween("[subject]", "[...rest]")).toStrictEqual([]);
  });

  test("an array standing against a settled shape leaves the comparison to fall", () => {
    expect(positionsBetween("[subject]", "'ok'")).toStrictEqual([]);
  });

  test("an array standing against a value nothing is known about keeps its positions open", () => {
    expect(positionsBetween("[new Response('a')]", "subject")).toStrictEqual([
      "NewExpression/none",
    ]);
    expect(positionsBetween("subject", "[new Response('a')]")).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  test("a hole in an array standing against an open value is compared with nothing", () => {
    expect(positionsBetween("[, new Response('a')]", "subject")).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  test("containers nested inside containers line up all the way down", () => {
    expect(positionsBetween("{ body: [subject] }", "{ body: [new Response('a')] }")).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  test("a shape the reader can settle from the syntax alone is reported as settled", () => {
    expect(isSettledShape(expressionIn("'ok'"))).toBe(true);
    expect(isSettledShape(expressionIn("`ok`"))).toBe(true);
    expect(isSettledShape(expressionIn("{ a: 1 }"))).toBe(true);
    expect(isSettledShape(expressionIn("[1]"))).toBe(true);
    expect(isSettledShape(expressionIn("() => 1"))).toBe(true);
    expect(isSettledShape(expressionIn("function () { return 1; }"))).toBe(true);
    expect(isSettledShape(expressionIn("class {}"))).toBe(true);
    expect(isSettledShape(expressionIn("new Response('a')"))).toBe(true);
  });

  test("a shape the reader cannot settle from the syntax alone is not reported as settled", () => {
    expect(isSettledShape(expressionIn("subject"))).toBe(false);
    expect(isSettledShape(expressionIn("read()"))).toBe(false);
    expect(isSettledShape(expressionIn("order.body"))).toBe(false);
  });
});
