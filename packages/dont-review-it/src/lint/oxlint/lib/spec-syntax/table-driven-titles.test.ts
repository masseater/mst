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

  test("a table that is not written out is runtime", () => {
    expect(spelledOf("rows", "scalar %s")).toBe("runtime");
  });

  test("a case value that is not written out is runtime", () => {
    expect(spelledOf("[compute()]", "scalar %s")).toBe("runtime");
    expect(spelledOf("[{ name: compute() }]", "object $name")).toBe("runtime");
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

  test("a positional placeholder against an object case leaves the title unreadable", () => {
    expect(spelledOf('[{ name: "alpha" }]', "object %s")).toBe("unreadable");
  });
});
