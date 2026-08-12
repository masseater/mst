import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  calleeMemberName,
  isFiniteVocabulary,
  literalUnionValues,
  propertyKeyName,
  schemaUnionLiterals,
  staticArrayValues,
  unwrapExpression,
  unwrapType,
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

const callFrom = (source: string): ESTree.CallExpression => {
  const expression = unwrapExpression(expressionFrom(source));
  if (expression.type !== "CallExpression") throw new Error(`Expected a call: ${source}`);
  return expression;
};

const arrayFrom = (source: string): ESTree.ArrayExpression => {
  const expression = unwrapExpression(expressionFrom(source));
  if (expression.type !== "ArrayExpression") throw new Error(`Expected an array: ${source}`);
  return expression;
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

  test("static arrays reject holes, spreads, and non-scalar expressions", () => {
    expect(staticArrayValues(arrayFrom('["draft", "published"]'))).toStrictEqual([
      "draft",
      "published",
    ]);
    expect(staticArrayValues(arrayFrom("[-1, +2, `draft`]"))).toStrictEqual([-1, 2, "draft"]);
    expect(staticArrayValues(arrayFrom('[null, true, "draft"]'))).toStrictEqual([
      null,
      true,
      "draft",
    ]);
    expect(staticArrayValues(arrayFrom('[-"draft", "published"]'))).toBeNull();
    expect(staticArrayValues(arrayFrom('[/draft/u, "published"]'))).toBeNull();
    expect(staticArrayValues(arrayFrom('["draft", , "published"]'))).toBeNull();
    expect(staticArrayValues(arrayFrom('["draft", ...values]'))).toBeNull();
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

  test("literal union extraction rejects non-unions and unwraps parenthesized types", () => {
    expect(literalUnionValues(unionFrom('type Status = "draft";'))).toBeNull();
    expect(unwrapType(unionFrom('type Status = ("draft" | "published");')).type).toBe(
      "TSUnionType",
    );
  });

  test("static string and template property keys have the same name", () => {
    expect(propertyKeyName(propertyFrom("({ enum: [] });").key)).toBe("enum");
    expect(propertyKeyName(propertyFrom('({ ["enum"]: [] });').key)).toBe("enum");
    expect(propertyKeyName(propertyFrom("({ [1]: [] });").key)).toBe("1");
    expect(propertyKeyName(propertyFrom("({ [`enum`]: [] });").key)).toBe("enum");
    expect(propertyKeyName(propertyFrom("({ [`${name}`]: [] });").key)).toBeNull();
    expect(propertyKeyName(propertyFrom("({ [/enum/u]: [] });").key)).toBeNull();
    expect(propertyKeyName(propertyFrom("({ [true]: [] });").key)).toBeNull();
    expect(propertyKeyName(propertyFrom("({ [names.enum]: [] });").key)).toBeNull();
  });

  test("schema member and union syntax is accepted only in the explicit forms", () => {
    expect(calleeMemberName(callFrom("schema.enum([])").callee)).toBe("enum");
    expect(calleeMemberName(callFrom("schema.enum?.([])").callee)).toBe("enum");
    expect(calleeMemberName(callFrom('schema["enum"]([])').callee)).toBeNull();
    expect(calleeMemberName(expressionFrom("schema"))).toBeNull();
    expect(
      schemaUnionLiterals(callFrom('z.union([z.literal("draft"), z.literal("published")])')),
    ).toMatchObject({ values: ["draft", "published"] });
    expect(schemaUnionLiterals(callFrom("z.union()"))).toBeNull();
    expect(schemaUnionLiterals(callFrom("z.union(...members)"))).toBeNull();
    expect(schemaUnionLiterals(callFrom("z.union(members)"))).toBeNull();
    expect(schemaUnionLiterals(callFrom('z.union(["draft", z.literal("published")])'))).toBeNull();
    expect(schemaUnionLiterals(callFrom('z.union([, z.literal("published")])'))).toBeNull();
    expect(
      schemaUnionLiterals(callFrom('z.union([z["literal"]("draft"), z.literal("published")])')),
    ).toBeNull();
    expect(
      schemaUnionLiterals(callFrom('z.union([z.literal(), z.literal("published")])')),
    ).toBeNull();
    expect(
      schemaUnionLiterals(callFrom('z.union([z.literal(...values), z.literal("published")])')),
    ).toBeNull();
  });
});
