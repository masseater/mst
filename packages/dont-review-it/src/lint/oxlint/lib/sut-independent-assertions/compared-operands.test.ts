import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vite-plus/test";

import { comparedOperandsOf, unwrapCopiedValue } from "./compared-operands.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionIn = (sourceText: string): ESTree.Expression => {
  const written = parseSync("spec.ts", `${sourceText};`).program.body[0] as ESTree.Statement;
  const bare = (written as ESTree.ExpressionStatement).expression;
  return bare.type === "ParenthesizedExpression" ? bare.expression : bare;
};

const callIn = (sourceText: string): ESTree.CallExpression =>
  expressionIn(sourceText) as ESTree.CallExpression;

const spelledTypesIn = (sourceText: string): readonly string[] | null => {
  const operands = comparedOperandsOf(callIn(sourceText));
  return operands === null
    ? null
    : [operands.subject, ...operands.expectations].map((written) => written.type);
};

describe("comparedOperandsOf", () => {
  it("hands over the subject and the expected value a matcher compares", () => {
    expect(spelledTypesIn('expect(report).toBe("a")')).toStrictEqual(["Identifier", "Literal"]);
  });

  it("hands over the subject alone for a matcher that takes no expected value", () => {
    expect(spelledTypesIn("expect(report).toBeTruthy()")).toStrictEqual(["Identifier"]);
  });

  it("hands over every expected value a matcher takes", () => {
    expect(spelledTypesIn("expect(mock).toHaveBeenNthCalledWith(1, sent)")).toStrictEqual([
      "Identifier",
      "Literal",
      "Identifier",
    ]);
  });

  it("hands over what a spread expected value spreads", () => {
    expect(spelledTypesIn("expect(report).toStrictEqual(...expected)")).toStrictEqual([
      "Identifier",
      "Identifier",
    ]);
  });

  it("reaches the subject through a run of modifiers", () => {
    expect(spelledTypesIn('expect(pending).resolves.not.toBe("a")')).toStrictEqual([
      "Identifier",
      "Literal",
    ]);
  });

  it("reaches the subject through a derived receiver", () => {
    expect(spelledTypesIn('expect.soft(report).toBe("a")')).toStrictEqual([
      "Identifier",
      "Literal",
    ]);
  });

  it("hands over nothing for a matcher carried by another receiver", () => {
    expect(spelledTypesIn('checker.toBe("a")')).toBe(null);
  });

  it("hands over nothing when the entry was handed a spread", () => {
    expect(spelledTypesIn('expect(...handed).toBe("a")')).toBe(null);
  });

  it("hands over nothing when the entry was handed nothing", () => {
    expect(spelledTypesIn('expect().toBe("a")')).toBe(null);
  });
});

describe("unwrapCopiedValue", () => {
  it("reaches through an object that only spreads one value", () => {
    expect(unwrapCopiedValue(expressionIn("({ ...report })")).type).toBe("Identifier");
  });

  it("reaches through an array that only spreads one value", () => {
    expect(unwrapCopiedValue(expressionIn("[...ids]")).type).toBe("Identifier");
  });

  it("reaches through a copy of a copy", () => {
    expect(unwrapCopiedValue(expressionIn("({ ...{ ...report } })")).type).toBe("Identifier");
  });

  it("stops at a shape that overrides part of what it spreads", () => {
    expect(unwrapCopiedValue(expressionIn('({ ...report, id: "a" })')).type).toBe(
      "ObjectExpression",
    );
  });

  it("stops at a shape written out without a spread", () => {
    expect(unwrapCopiedValue(expressionIn('({ id: "a" })')).type).toBe("ObjectExpression");
  });

  it("hands back a value that is no copy at all", () => {
    expect(unwrapCopiedValue(expressionIn("report")).type).toBe("Identifier");
  });
});
