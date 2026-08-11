import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { tableDrivenTitlesOf, type TableDrivenTitles } from "./table-driven-titles.ts";

import type { ESTree } from "@oxlint/plugins";

const tableIn = (source: string): ESTree.Expression => {
  const [statement] = parseSync("spec.ts", `const rows = ${source};`).program.body;
  const declaration = statement as ESTree.VariableDeclaration;
  const [declarator] = declaration.declarations;
  return (declarator as ESTree.VariableDeclarator).init as ESTree.Expression;
};

const titlesOf = (table: string, template: string): TableDrivenTitles =>
  tableDrivenTitlesOf(tableIn(table), template);

const spelledOf = (table: string, template: string): readonly string[] | string => {
  const resolved = titlesOf(table, template);
  return resolved.kind === "spelled" ? resolved.titles : resolved.kind;
};

describe("dont-review-it/spec-syntax/table-driven-titles", () => {
  test("a scalar table spells one title per case through the string placeholder", () => {
    expect(spelledOf("[1, 2]", "scalar %s")).toStrictEqual(["scalar 1", "scalar 2"]);
  });

  test("a string case is spelled without quotes through the string placeholder", () => {
    expect(spelledOf('["one", "two"]', "word %s")).toStrictEqual(["word one", "word two"]);
  });

  test("a tuple table takes one case value per positional placeholder", () => {
    expect(spelledOf('[[1, "one"], [2, "two"]]', "tuple %i is %s")).toStrictEqual([
      "tuple 1 is one",
      "tuple 2 is two",
    ]);
  });

  test("a number placeholder spells a number case", () => {
    expect(spelledOf("[1, 2]", "count %d")).toStrictEqual(["count 1", "count 2"]);
  });

  test("an integer placeholder spells only the whole part of a fractional case", () => {
    expect(spelledOf("[1.5]", "count %i")).toStrictEqual(["count 1"]);
  });

  test("an object table spells a named value the way the runner displays it", () => {
    expect(
      spelledOf('[{ name: "alpha", size: 1 }, { name: "beta", size: 2 }]', "object $name of $size"),
    ).toStrictEqual(["object 'alpha' of 1", "object 'beta' of 2"]);
  });

  test("the index placeholder counts from zero and its companion counts from one", () => {
    expect(spelledOf("[1, 2]", "case %# and %$")).toStrictEqual(["case 0 and 1", "case 1 and 2"]);
  });

  test("a doubled percent stands for one percent and takes no case value", () => {
    expect(spelledOf("[1]", "100%% done")).toStrictEqual(["100% done"]);
  });

  test("a template without a placeholder repeats one title for every case", () => {
    expect(spelledOf("[1, 2]", "no placeholder")).toStrictEqual([
      "no placeholder",
      "no placeholder",
    ]);
  });

  test("a negative number reads as the number it spells", () => {
    expect(spelledOf("[-1]", "below %s")).toStrictEqual(["below -1"]);
  });

  test("a null case spells the word the runner prints for it", () => {
    expect(spelledOf("[null]", "value %s")).toStrictEqual(["value null"]);
  });

  test("a boolean case spells the word it is written as", () => {
    expect(spelledOf("[true, false]", "flag %s")).toStrictEqual(["flag true", "flag false"]);
  });

  test("a template literal case with nothing substituted into it reads as its text", () => {
    expect(spelledOf("[`alpha`]", "word %s")).toStrictEqual(["word alpha"]);
  });

  test("a table that is not written out is runtime", () => {
    expect(spelledOf("rows", "scalar %s")).toBe("runtime");
  });

  test("a table that spreads another value is runtime", () => {
    expect(spelledOf("[...cases]", "scalar %s")).toBe("runtime");
  });

  test("a case value that is not written out is runtime", () => {
    expect(spelledOf("[compute()]", "scalar %s")).toBe("runtime");
    expect(spelledOf("[{ name: compute() }]", "object $name")).toBe("runtime");
  });

  test("a literal that is no scalar the runner spells is runtime", () => {
    expect(spelledOf("[/^a/u]", "pattern %s")).toBe("runtime");
  });

  test("a negation of something that is not written out is runtime", () => {
    expect(spelledOf("[-count]", "below %s")).toBe("runtime");
  });

  test("a tuple case with a hole in it is runtime", () => {
    expect(spelledOf("[[1, , 2]]", "tuple %s")).toBe("runtime");
  });

  test("a case object that spreads another value is runtime", () => {
    expect(spelledOf("[{ ...base }]", "object $name")).toBe("runtime");
  });

  test("a case object that computes a key is runtime", () => {
    expect(spelledOf("[{ [key]: 1 }]", "object $name")).toBe("runtime");
  });

  test("a case object whose key is no name is runtime", () => {
    expect(spelledOf('[{ 1: "alpha" }]', "object $1")).toBe("runtime");
  });

  test("a case object that carries a reference is runtime", () => {
    expect(spelledOf("[{ size }]", "object $size")).toBe("runtime");
  });

  test("a placeholder outside the spelled set leaves the title unreadable", () => {
    expect(spelledOf("[1]", "inspected %o")).toBe("unreadable");
  });

  test("a named reference the case does not carry leaves the title unreadable", () => {
    expect(spelledOf('[{ name: "alpha" }]', "object $missing")).toBe("unreadable");
  });

  test("a number placeholder against a string case leaves the title unreadable", () => {
    expect(spelledOf('["one"]', "count %d")).toBe("unreadable");
  });

  test("an integer placeholder against a string case leaves the title unreadable", () => {
    expect(spelledOf('["one"]', "count %i")).toBe("unreadable");
  });

  test("a named value longer than the runner writes out leaves the title unreadable", () => {
    expect(spelledOf('[{ name: "an unusually long value" }]', "object $name")).toBe("unreadable");
  });

  test("a positional placeholder against an object case leaves the title unreadable", () => {
    expect(spelledOf('[{ name: "alpha" }]', "object %s")).toBe("unreadable");
  });
});
