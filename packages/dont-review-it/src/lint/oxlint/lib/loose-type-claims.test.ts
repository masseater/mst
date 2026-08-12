import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  declaredReturnTypeOf,
  isConcreteTypeClaim,
  isTypeAssertion,
  looseTypeNodeOf,
  unwrappedValueOf,
} from "./loose-type-claims.ts";

import type { ESTree } from "@oxlint/plugins";

const firstStatementIn = (sourceText: string): ESTree.Statement =>
  parseSync("claim.ts", sourceText).program.body[0] as ESTree.Statement;

const declaredType = (sourceText: string): ESTree.TSType =>
  (firstStatementIn(`type Held = ${sourceText};`) as ESTree.TSTypeAliasDeclaration).typeAnnotation;

const boundValue = (sourceText: string): ESTree.Expression => {
  const declared = firstStatementIn(`const held = ${sourceText};`);
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  return declarator?.init as ESTree.Expression;
};

describe("loose type claims", () => {
  test("the any keyword names the type that takes every value", () => {
    expect(looseTypeNodeOf(declaredType("any"))?.type).toBe("TSAnyKeyword");
  });

  test("the unknown keyword names the type that carries no shape", () => {
    expect(looseTypeNodeOf(declaredType("unknown"))?.type).toBe("TSUnknownKeyword");
  });

  test("a named type carries a shape of its own", () => {
    expect(looseTypeNodeOf(declaredType("Row"))).toBe(null);
  });

  test("a parenthesised any keyword is the type the parentheses hold", () => {
    expect(looseTypeNodeOf(declaredType("(any)"))?.type).toBe("TSAnyKeyword");
  });

  test("a union holding any collapses onto any", () => {
    expect(looseTypeNodeOf(declaredType("string | any"))?.type).toBe("TSAnyKeyword");
  });

  test("a union holding unknown collapses onto unknown", () => {
    expect(looseTypeNodeOf(declaredType("string | unknown"))?.type).toBe("TSUnknownKeyword");
  });

  test("a union holding both collapses onto any", () => {
    expect(looseTypeNodeOf(declaredType("unknown | any"))?.type).toBe("TSAnyKeyword");
  });

  test("a union of named types collapses onto neither", () => {
    expect(looseTypeNodeOf(declaredType("string | number"))).toBe(null);
  });

  test("a named type is a concrete claim", () => {
    expect(isConcreteTypeClaim(declaredType("Row"))).toBe(true);
  });

  test("a qualified type name is a concrete claim", () => {
    expect(isConcreteTypeClaim(declaredType("schema.Row"))).toBe(true);
  });

  test("the unknown keyword claims nothing concrete", () => {
    expect(isConcreteTypeClaim(declaredType("unknown"))).toBe(false);
  });

  test("the const target of a literal assertion claims nothing concrete", () => {
    const assertion = boundValue("[1, 2] as const") as ESTree.TSAsExpression;
    expect(isConcreteTypeClaim(assertion.typeAnnotation)).toBe(false);
  });

  test("an as expression is a type assertion", () => {
    expect(isTypeAssertion(boundValue("input as Row"))).toBe(true);
  });

  test("an angle bracket expression is a type assertion", () => {
    expect(isTypeAssertion(boundValue("<Row>input"))).toBe(true);
  });

  test("a satisfies expression asserts nothing", () => {
    expect(isTypeAssertion(boundValue("input satisfies Row"))).toBe(false);
  });

  test("parentheses around a name leave the name standing", () => {
    expect(unwrappedValueOf(boundValue("(input)")).type).toBe("Identifier");
  });

  test("a non null suffix leaves the name standing", () => {
    expect(unwrappedValueOf(boundValue("input!")).type).toBe("Identifier");
  });

  test("an optional chain leaves the member read standing", () => {
    expect(unwrappedValueOf(boundValue("input?.row")).type).toBe("MemberExpression");
  });

  test("a call keeps the shape it has", () => {
    expect(unwrappedValueOf(boundValue("parse(input)")).type).toBe("CallExpression");
  });

  test("a function with a return annotation hands back the type it declares", () => {
    const declared = firstStatementIn("function read(): Row { return row; }");
    expect(declaredReturnTypeOf(declared)?.typeAnnotation.type).toBe("TSTypeReference");
  });

  test("a function without a return annotation declares no return type", () => {
    expect(declaredReturnTypeOf(firstStatementIn("function read() { return row; }"))).toBe(null);
  });

  test("a statement that returns nothing declares no return type", () => {
    expect(declaredReturnTypeOf(firstStatementIn("const held = 1;"))).toBe(null);
  });
});
