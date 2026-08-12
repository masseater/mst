import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  isFiniteVocabulary,
  literalUnionValues,
  propertyKeyName,
  scalarLiteralValue,
  unwrapExpression,
} from "./finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionFrom = (source: string): ESTree.Expression => {
  const parsed = parseSync("source.ts", source);
  const [statement] = parsed.program.body;
  if (parsed.errors.length !== 0 || statement?.type !== "ExpressionStatement") {
    throw new Error(`Expected one expression statement: ${source}`);
  }
  return statement.expression as ESTree.Expression;
};

const unionFrom = (source: string): ESTree.TSType => {
  const parsed = parseSync("source.ts", source);
  const [statement] = parsed.program.body;
  if (parsed.errors.length !== 0 || statement?.type !== "TSTypeAliasDeclaration") {
    throw new Error(`Expected one type alias: ${source}`);
  }
  return statement.typeAnnotation as ESTree.TSType;
};

const propertyFrom = (source: string): ESTree.ObjectProperty => {
  const expression = unwrapExpression(expressionFrom(source));
  if (expression.type !== "ObjectExpression") throw new Error(`Expected an object: ${source}`);
  const [property] = expression.properties;
  if (property?.type !== "Property") throw new Error(`Expected one property: ${source}`);
  return property;
};

describe("finite-value-syntax", () => {
  test("two distinct spellings are a vocabulary", () => {
    expect(isFiniteVocabulary(["draft", "published"])).toBe(true);
  });

  test("one spelling names a single value rather than a vocabulary", () => {
    expect(isFiniteVocabulary(["draft"])).toBe(false);
  });

  test("the same spelling repeated is still one value", () => {
    expect(isFiniteVocabulary(["draft", "draft"])).toBe(false);
  });

  test("both booleans spelled out are the two sides of a flag, not a vocabulary", () => {
    expect(isFiniteVocabulary([true, false])).toBe(false);
  });

  test("a boolean beside a spelling is a vocabulary because the flag is not the whole set", () => {
    expect(isFiniteVocabulary([true, "draft"])).toBe(true);
  });

  test("a number and the same digits written as text are two values", () => {
    expect(isFiniteVocabulary([1, "1"])).toBe(true);
  });

  test("null is a scalar value while undefined remains the extraction sentinel", () => {
    expect(scalarLiteralValue(expressionFrom("null;"))).toBeNull();
    expect(scalarLiteralValue(expressionFrom("undefined;"))).toBeUndefined();
  });

  test("nested signs and transparent wrappers preserve the final numeric value", () => {
    expect(scalarLiteralValue(expressionFrom("(-+1! as const);"))).toBe(-1);
  });

  test("literal unions retain null and reject undefined members", () => {
    expect(
      literalUnionValues(unionFrom('type Status = "draft" | null | "published";')),
    ).toStrictEqual(["draft", null, "published"]);
    expect(
      literalUnionValues(unionFrom('type Status = "draft" | undefined | "published";')),
    ).toBeNull();
  });

  test("template literal types with substitutions are not finite scalar spellings", () => {
    expect(
      literalUnionValues(unionFrom('type Status = `draft-${string}` | "published";')),
    ).toBeNull();
  });

  test("static string and template property keys have the same name", () => {
    expect(propertyKeyName(propertyFrom('({ ["enum"]: [] });').key)).toBe("enum");
    expect(propertyKeyName(propertyFrom("({ [`enum`]: [] });").key)).toBe("enum");
  });
});
