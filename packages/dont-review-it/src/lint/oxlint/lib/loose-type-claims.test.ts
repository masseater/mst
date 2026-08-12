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

const it = test
  .extend("keywordNamedByAny", () => {
    const declared = parseSync("claim.ts", "type Held = any;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("keywordNamedByUnknown", () => {
    const declared = parseSync("claim.ts", "type Held = unknown;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("looseNodeOfNamedType", () => {
    const declared = parseSync("claim.ts", "type Held = Row;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    return looseTypeNodeOf(declared.typeAnnotation);
  })
  .extend("keywordNamedByParenthesisedAny", () => {
    const declared = parseSync("claim.ts", "type Held = (any);").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("keywordNamedByUnionHoldingAny", () => {
    const declared = parseSync("claim.ts", "type Held = string | any;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("keywordNamedByUnionHoldingUnknown", () => {
    const declared = parseSync("claim.ts", "type Held = string | unknown;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("keywordNamedByUnionHoldingBoth", () => {
    const declared = parseSync("claim.ts", "type Held = unknown | any;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    const loose = looseTypeNodeOf(declared.typeAnnotation);
    return loose === null ? null : loose.type;
  })
  .extend("looseNodeOfUnionOfNamedTypes", () => {
    const declared = parseSync("claim.ts", "type Held = string | number;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    return looseTypeNodeOf(declared.typeAnnotation);
  })
  .extend("concretenessOfNamedType", () => {
    const declared = parseSync("claim.ts", "type Held = Row;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    return isConcreteTypeClaim(declared.typeAnnotation);
  })
  .extend("concretenessOfQualifiedName", () => {
    const declared = parseSync("claim.ts", "type Held = schema.Row;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    return isConcreteTypeClaim(declared.typeAnnotation);
  })
  .extend("concretenessOfUnknownKeyword", () => {
    const declared = parseSync("claim.ts", "type Held = unknown;").program
      .body[0] as ESTree.TSTypeAliasDeclaration;
    return isConcreteTypeClaim(declared.typeAnnotation);
  })
  .extend("concretenessOfConstAssertionTarget", () => {
    const declared = parseSync("claim.ts", "const held = [1, 2] as const;").program
      .body[0] as ESTree.VariableDeclaration;
    const assertion = declared.declarations[0]?.init as ESTree.TSAsExpression;
    return isConcreteTypeClaim(assertion.typeAnnotation);
  })
  .extend("assertionInAsExpression", () => {
    const declared = parseSync("claim.ts", "const held = input as Row;").program
      .body[0] as ESTree.VariableDeclaration;
    return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("assertionInAngleBracketExpression", () => {
    const declared = parseSync("claim.ts", "const held = <Row>input;").program
      .body[0] as ESTree.VariableDeclaration;
    return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("assertionInSatisfiesExpression", () => {
    const declared = parseSync("claim.ts", "const held = input satisfies Row;").program
      .body[0] as ESTree.VariableDeclaration;
    return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("shapeUnderParentheses", () => {
    const declared = parseSync("claim.ts", "const held = (input);").program
      .body[0] as ESTree.VariableDeclaration;
    const written = declared.declarations[0]?.init;
    return written === null || written === undefined ? null : unwrappedValueOf(written).type;
  })
  .extend("shapeUnderNonNullSuffix", () => {
    const declared = parseSync("claim.ts", "const held = input!;").program
      .body[0] as ESTree.VariableDeclaration;
    const written = declared.declarations[0]?.init;
    return written === null || written === undefined ? null : unwrappedValueOf(written).type;
  })
  .extend("shapeUnderOptionalChain", () => {
    const declared = parseSync("claim.ts", "const held = input?.row;").program
      .body[0] as ESTree.VariableDeclaration;
    const written = declared.declarations[0]?.init;
    return written === null || written === undefined ? null : unwrappedValueOf(written).type;
  })
  .extend("shapeOfCall", () => {
    const declared = parseSync("claim.ts", "const held = parse(input);").program
      .body[0] as ESTree.VariableDeclaration;
    const written = declared.declarations[0]?.init;
    return written === null || written === undefined ? null : unwrappedValueOf(written).type;
  })
  .extend("shapeOfDeclaredReturnType", () => {
    const declared = parseSync("claim.ts", "function read(): Row { return row; }").program
      .body[0] as ESTree.Statement;
    const annotated = declaredReturnTypeOf(declared);
    return annotated === null ? null : annotated.typeAnnotation.type;
  })
  .extend("returnTypeOfUnannotatedFunction", () => {
    const declared = parseSync("claim.ts", "function read() { return row; }").program
      .body[0] as ESTree.Statement;
    return declaredReturnTypeOf(declared);
  })
  .extend("returnTypeOfStatementReturningNothing", () => {
    const declared = parseSync("claim.ts", "const held = 1;").program.body[0] as ESTree.Statement;
    return declaredReturnTypeOf(declared);
  });

describe("loose type claims", () => {
  it("the any keyword names the type that takes every value", ({ keywordNamedByAny }) => {
    expect(keywordNamedByAny).toBe("TSAnyKeyword");
  });

  it("the unknown keyword names the type that carries no shape", ({ keywordNamedByUnknown }) => {
    expect(keywordNamedByUnknown).toBe("TSUnknownKeyword");
  });

  it("a named type carries a shape of its own", ({ looseNodeOfNamedType }) => {
    expect(looseNodeOfNamedType).toBe(null);
  });

  it("a parenthesised any keyword is the type the parentheses hold", ({
    keywordNamedByParenthesisedAny,
  }) => {
    expect(keywordNamedByParenthesisedAny).toBe("TSAnyKeyword");
  });

  it("a union holding any collapses onto any", ({ keywordNamedByUnionHoldingAny }) => {
    expect(keywordNamedByUnionHoldingAny).toBe("TSAnyKeyword");
  });

  it("a union holding unknown collapses onto unknown", ({ keywordNamedByUnionHoldingUnknown }) => {
    expect(keywordNamedByUnionHoldingUnknown).toBe("TSUnknownKeyword");
  });

  it("a union holding both collapses onto any", ({ keywordNamedByUnionHoldingBoth }) => {
    expect(keywordNamedByUnionHoldingBoth).toBe("TSAnyKeyword");
  });

  it("a union of named types collapses onto neither", ({ looseNodeOfUnionOfNamedTypes }) => {
    expect(looseNodeOfUnionOfNamedTypes).toBe(null);
  });

  it("a named type is a concrete claim", ({ concretenessOfNamedType }) => {
    expect(concretenessOfNamedType).toBe(true);
  });

  it("a qualified type name is a concrete claim", ({ concretenessOfQualifiedName }) => {
    expect(concretenessOfQualifiedName).toBe(true);
  });

  it("the unknown keyword claims nothing concrete", ({ concretenessOfUnknownKeyword }) => {
    expect(concretenessOfUnknownKeyword).toBe(false);
  });

  it("the const target of a literal assertion claims nothing concrete", ({
    concretenessOfConstAssertionTarget,
  }) => {
    expect(concretenessOfConstAssertionTarget).toBe(false);
  });

  it("an as expression is a type assertion", ({ assertionInAsExpression }) => {
    expect(assertionInAsExpression).toBe(true);
  });

  it("an angle bracket expression is a type assertion", ({ assertionInAngleBracketExpression }) => {
    expect(assertionInAngleBracketExpression).toBe(true);
  });

  it("a satisfies expression asserts nothing", ({ assertionInSatisfiesExpression }) => {
    expect(assertionInSatisfiesExpression).toBe(false);
  });

  it("parentheses around a name leave the name standing", ({ shapeUnderParentheses }) => {
    expect(shapeUnderParentheses).toBe("Identifier");
  });

  it("a non null suffix leaves the name standing", ({ shapeUnderNonNullSuffix }) => {
    expect(shapeUnderNonNullSuffix).toBe("Identifier");
  });

  it("an optional chain leaves the member read standing", ({ shapeUnderOptionalChain }) => {
    expect(shapeUnderOptionalChain).toBe("MemberExpression");
  });

  it("a call keeps the shape it has", ({ shapeOfCall }) => {
    expect(shapeOfCall).toBe("CallExpression");
  });

  it("a function with a return annotation hands back the type it declares", ({
    shapeOfDeclaredReturnType,
  }) => {
    expect(shapeOfDeclaredReturnType).toBe("TSTypeReference");
  });

  it("a function without a return annotation declares no return type", ({
    returnTypeOfUnannotatedFunction,
  }) => {
    expect(returnTypeOfUnannotatedFunction).toBe(null);
  });

  it("a statement that returns nothing declares no return type", ({
    returnTypeOfStatementReturningNothing,
  }) => {
    expect(returnTypeOfStatementReturningNothing).toBe(null);
  });
});
