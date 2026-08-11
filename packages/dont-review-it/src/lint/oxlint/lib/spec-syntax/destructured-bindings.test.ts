import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { destructuredBindingsOf } from "./destructured-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

const statementIn = (source: string): ESTree.Statement =>
  parseSync("spec.ts", source).program.body[0] as ESTree.Statement;

const declaredPatternIn = (source: string): ESTree.BindingPattern => {
  const declaration = statementIn(`${source};`) as ESTree.VariableDeclaration;
  return (declaration.declarations[0] as ESTree.VariableDeclarator).id;
};

const parameterIn = (source: string): ESTree.ParamPattern => {
  const declaration = statementIn(`const held = ${source};`) as ESTree.VariableDeclaration;
  const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
  return (declarator.init as ESTree.ArrowFunctionExpression).params[0] as ESTree.ParamPattern;
};

const constructorParameterIn = (source: string): ESTree.ParamPattern => {
  const declared = statementIn(source) as ESTree.Class;
  const member = declared.body.body[0] as ESTree.MethodDefinition;
  return member.value.params[0] as ESTree.ParamPattern;
};

const readingOf = (
  pattern: ESTree.BindingPattern | ESTree.ParamPattern,
): readonly { readonly name: string; readonly depth: number }[] =>
  destructuredBindingsOf(pattern).map((binding) => ({
    name: binding.name.name,
    depth: binding.depth,
  }));

describe("destructured-bindings", () => {
  test("a name bound whole sits at the depth of the value it names", () => {
    expect(readingOf(parameterIn("(context) => context"))).toStrictEqual([
      { name: "context", depth: 0 },
    ]);
  });

  test("a key taken out of an object pattern sits one level under the value", () => {
    expect(readingOf(parameterIn("({ report }) => report"))).toStrictEqual([
      { name: "report", depth: 1 },
    ]);
  });

  test("renaming a key leaves the level the name was taken from unchanged", () => {
    expect(readingOf(parameterIn("({ report: summary }) => summary"))).toStrictEqual([
      { name: "summary", depth: 1 },
    ]);
  });

  test("a key taken out of a nested pattern sits one level under the key above it", () => {
    expect(readingOf(parameterIn("({ report: { total } }) => total"))).toStrictEqual([
      { name: "total", depth: 2 },
    ]);
  });

  test("a default value written on a pattern adds no level of its own", () => {
    expect(readingOf(parameterIn("({ report = fallback }) => report"))).toStrictEqual([
      { name: "report", depth: 1 },
    ]);
  });

  test("a parameter carrying a default value is read through to the pattern it holds", () => {
    expect(readingOf(parameterIn("({ report } = empty) => report"))).toStrictEqual([
      { name: "report", depth: 1 },
    ]);
  });

  test("the rest of an object pattern names what is left of the same value", () => {
    expect(readingOf(parameterIn("({ report, ...rest }) => rest"))).toStrictEqual([
      { name: "report", depth: 1 },
      { name: "rest", depth: 0 },
    ]);
  });

  test("an element taken out of an array pattern sits one level under the list", () => {
    expect(readingOf(parameterIn("({ rows: [first, second] }) => first"))).toStrictEqual([
      { name: "first", depth: 2 },
      { name: "second", depth: 2 },
    ]);
  });

  test("a hole in an array pattern names nothing", () => {
    expect(readingOf(parameterIn("([, second]) => second"))).toStrictEqual([
      { name: "second", depth: 1 },
    ]);
  });

  test("the rest of an array pattern names what is left of the same list", () => {
    expect(readingOf(parameterIn("([first, ...rest]) => rest"))).toStrictEqual([
      { name: "first", depth: 1 },
      { name: "rest", depth: 0 },
    ]);
  });

  test("a rest parameter names what is left of the argument list", () => {
    expect(readingOf(parameterIn("(...handed) => handed"))).toStrictEqual([
      { name: "handed", depth: 0 },
    ]);
  });

  test("a declared pattern is read the same way as a parameter pattern", () => {
    expect(readingOf(declaredPatternIn("const { report: { total } } = context"))).toStrictEqual([
      { name: "total", depth: 2 },
    ]);
  });

  test("a parameter property declares a field rather than a destructured binding", () => {
    expect(
      readingOf(constructorParameterIn("class Held { constructor(readonly seen: number) {} }")),
    ).toStrictEqual([]);
  });
});
