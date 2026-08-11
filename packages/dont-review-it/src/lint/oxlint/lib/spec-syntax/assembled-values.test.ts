import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { assembledShapeOf, isEmptyContainer, WRITTEN_OUT_SHAPE } from "./assembled-values.ts";

import type { ESTree } from "@oxlint/plugins";

const valueIn = (valueSource: string): ESTree.Expression => {
  const declared = parseSync("spec.ts", `const written = ${valueSource};`).program
    .body[0] as ESTree.Statement;
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  if (declarator === undefined) throw new Error(`nothing is declared by: ${valueSource}`);

  return declarator.init as ESTree.Expression;
};

describe("assembled-values", () => {
  test("a string spelled out in the source is a value the spec wrote", () => {
    expect(assembledShapeOf(valueIn('"a"'))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("a template without substitutions is a value the spec wrote", () => {
    expect(assembledShapeOf(valueIn("`a`"))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("a template carrying a substitution is not a value this reading can spell", () => {
    expect(assembledShapeOf(valueIn("`id ${report.id}`"))).toBe(null);
  });

  test("the name of the absent value is a value the spec wrote", () => {
    expect(assembledShapeOf(valueIn("undefined"))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("a name other than the absent value is not a value this reading can spell", () => {
    expect(assembledShapeOf(valueIn("report"))).toBe(null);
  });

  test("discarding an expression spells the absent value out", () => {
    expect(assembledShapeOf(valueIn("void 0"))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("a signed number is still a number spelled out in the source", () => {
    expect(assembledShapeOf(valueIn("-1"))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("a sign in front of a name spells nothing out", () => {
    expect(assembledShapeOf(valueIn("-count"))).toBe(null);
  });

  test("an operator standing in front of a name spells nothing out", () => {
    expect(assembledShapeOf(valueIn("!flag"))).toBe(null);
  });

  test("an operator standing in front of a spelled-out value spells one out", () => {
    expect(assembledShapeOf(valueIn("!true"))).toBe(WRITTEN_OUT_SHAPE);
  });

  test("an object literal is a shape the spec assembled", () => {
    expect(assembledShapeOf(valueIn('{ id: "a" }'))).toBe("an object literal");
  });

  test("an array literal is a shape the spec assembled", () => {
    expect(assembledShapeOf(valueIn('["a"]'))).toBe("an array literal");
  });

  test("a constructor call is a shape the spec assembled", () => {
    expect(assembledShapeOf(valueIn("new Report(input)"))).toBe("a value a constructor built here");
  });

  test("a type assertion around an assembled shape is stripped before it is read", () => {
    expect(assembledShapeOf(valueIn('({ id: "a" }) as Report'))).toBe("an object literal");
  });

  test("a call is not a shape the spec assembled", () => {
    expect(assembledShapeOf(valueIn("summarise(input)"))).toBe(null);
  });

  test("an array literal holding nothing is an empty container", () => {
    expect(isEmptyContainer(valueIn("[]"))).toBe(true);
  });

  test("an object literal holding nothing is an empty container", () => {
    expect(isEmptyContainer(valueIn("({})"))).toBe(true);
  });

  test("an array literal holding an element is not an empty container", () => {
    expect(isEmptyContainer(valueIn("[seed]"))).toBe(false);
  });

  test("an object literal holding a property is not an empty container", () => {
    expect(isEmptyContainer(valueIn('({ id: "a" })'))).toBe(false);
  });

  test("a call is not a container this reading can see into", () => {
    expect(isEmptyContainer(valueIn("summarise(input)"))).toBe(false);
  });
});
