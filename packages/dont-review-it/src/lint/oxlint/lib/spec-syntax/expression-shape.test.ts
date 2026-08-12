import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { syntaxShapeOf } from "./expression-shape.ts";

import type { ESTree } from "@oxlint/plugins";

const shapeOfSource = (expressionSource: string): string => {
  const parsed = parseSync("spec.ts", `const written = ${expressionSource};`);
  const declared = parsed.program.body[0] as ESTree.Statement;
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  return syntaxShapeOf(declarator?.init);
};

const sharesShape = (left: string, right: string): boolean =>
  shapeOfSource(left) === shapeOfSource(right);

describe("notation this reading absorbs", () => {
  test("the quotes a string is written in are notation", () => {
    expect(sharesShape("{ id: 'a' }", '{ id: "a" }')).toBe(true);
  });

  test("a template with nothing substituted into it spells the same string", () => {
    expect(sharesShape("`a`", '"a"')).toBe(true);
  });

  test("the notation a number is written in is notation", () => {
    expect(sharesShape("2", "2.0")).toBe(true);
  });

  test("a number written in hexadecimal is the same number", () => {
    expect(sharesShape("2", "0x2")).toBe(true);
  });

  test("the order properties are written in is notation", () => {
    expect(sharesShape('{ id: "a", total: 2 }', '{ total: 2, id: "a" }')).toBe(true);
  });

  test("a property written in shorthand names the same property", () => {
    expect(sharesShape("{ id }", "{ id: id }")).toBe(true);
  });

  test("a trailing comma is notation", () => {
    expect(sharesShape('{ id: "a" }', '{ id: "a", }')).toBe(true);
  });

  test("parentheses around an expression are notation", () => {
    expect(sharesShape('({ id: "a" })', '{ id: "a" }')).toBe(true);
  });

  test("line breaks and indentation are notation", () => {
    expect(sharesShape('{\n  id: "a",\n  total: 2,\n}', '{ id: "a", total: 2 }')).toBe(true);
  });

  test("a type assertion around an expression leaves the expression it wraps", () => {
    expect(sharesShape('{ id: "a" } as Report', '{ id: "a" }')).toBe(true);
  });

  test("a satisfies clause around an expression leaves the expression it wraps", () => {
    expect(sharesShape('{ id: "a" } satisfies Report', '{ id: "a" }')).toBe(true);
  });

  test("a non-null assertion leaves the expression it wraps", () => {
    expect(sharesShape("report!", "report")).toBe(true);
  });

  test("an optional member access reaches the same member", () => {
    expect(sharesShape("report?.id", "report.id")).toBe(true);
  });

  test("awaiting an expression leaves the expression it wraps", () => {
    expect(sharesShape("await summarise()", "summarise()")).toBe(true);
  });
});

describe("what this reading keeps apart", () => {
  test("two spellings of a name are two names", () => {
    expect(sharesShape("{ id: total }", "{ id: count }")).toBe(false);
  });

  test("two property names are two properties", () => {
    expect(sharesShape('{ id: "a" }', '{ name: "a" }')).toBe(false);
  });

  test("two callees are two calls", () => {
    expect(sharesShape("summarise(1)", "report(1)")).toBe(false);
  });

  test("the order of array elements is part of the value", () => {
    expect(sharesShape("[1, 2]", "[2, 1]")).toBe(false);
  });

  test("a string and a number written the same way are two values", () => {
    expect(sharesShape('"1"', "1")).toBe(false);
  });

  test("two patterns are two regular expressions", () => {
    expect(sharesShape("/a/u", "/b/u")).toBe(false);
  });

  test("the same pattern is the same regular expression", () => {
    expect(sharesShape("/a/u", "/a/u")).toBe(true);
  });

  test("a wide integer and a number are two values", () => {
    expect(sharesShape("1n", "1")).toBe(false);
  });

  test("the same wide integer is the same value", () => {
    expect(sharesShape("1n", "1n")).toBe(true);
  });

  test("two substitutions into a template are two strings", () => {
    expect(sharesShape("`a${id}`", "`a${total}`")).toBe(false);
  });

  test("the same substitution into a template is the same string", () => {
    expect(sharesShape("`a${id}`", "`a${id}`")).toBe(true);
  });

  test("a value handed nowhere is spelled apart from a value handed to a call", () => {
    expect(sharesShape("undefined", "summarise(undefined)")).toBe(false);
  });

  test("a template holding no piece of text spells no string of its own", () => {
    const empty = syntaxShapeOf({ type: "TemplateLiteral", expressions: [], quasis: [] });

    expect(empty === shapeOfSource('""')).toBe(false);
  });
});
