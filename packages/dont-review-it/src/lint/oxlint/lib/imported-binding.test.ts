import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { collectBinding, isReferenceOf, newBinding } from "./imported-binding.ts";

import type { ESTree } from "@oxlint/plugins";

const targetIn = (source: string) => {
  const target = { exportedName: "oxlint", binding: newBinding() };
  for (const statement of parseSync("config.ts", source, { preserveParens: false }).program.body) {
    if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
      collectBinding(statement as ESTree.ImportDeclaration, target);
    }
  }
  return target;
};

const expressionIn = (source: string): ESTree.Expression => {
  const [statement] = parseSync("config.ts", `${source};`, { preserveParens: false }).program.body;
  if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
  return statement.expression as ESTree.Expression;
};

describe("imported binding", () => {
  test("recognizes a named value import through its local alias", () => {
    const target = targetIn(`import { oxlint as presetConfig } from "preset";`);

    expect(isReferenceOf(expressionIn("presetConfig"), target)).toBe(true);
  });

  test("recognizes an uncomputed member of a namespace value import", () => {
    const target = targetIn(`import * as preset from "preset";`);

    expect(isReferenceOf(expressionIn("preset.oxlint"), target)).toBe(true);
  });

  test("rejects a computed member of a namespace import", () => {
    const target = targetIn(`import * as preset from "preset";`);

    expect(isReferenceOf(expressionIn(`preset["oxlint"]`), target)).toBe(false);
  });

  test("does not collect a declaration imported only as a type", () => {
    const target = targetIn(`import type { oxlint } from "preset";`);

    expect(isReferenceOf(expressionIn("oxlint"), target)).toBe(false);
  });

  test("does not collect an inline type-only specifier", () => {
    const target = targetIn(`import { type oxlint } from "preset";`);

    expect(isReferenceOf(expressionIn("oxlint"), target)).toBe(false);
  });
});
