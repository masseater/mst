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

describe("looseTypeNodeOf", () => {
  describe("a type written as the any keyword", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = any;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("names the type that takes every value", ({ keyword }) => {
      expect(keyword).toBe("TSAnyKeyword");
    });
  });

  describe("a type written as the unknown keyword", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = unknown;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("names the type that carries no shape", ({ keyword }) => {
      expect(keyword).toBe("TSUnknownKeyword");
    });
  });

  describe("a named type", () => {
    const it = test.extend("looseNode", () => {
      const declared = parseSync("claim.ts", "type Held = Row;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      return looseTypeNodeOf(declared.typeAnnotation);
    });

    it("carries a shape of its own", ({ looseNode }) => {
      expect(looseNode).toBe(null);
    });
  });

  describe("an any keyword wrapped in parentheses", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = (any);").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("is the type the parentheses hold", ({ keyword }) => {
      expect(keyword).toBe("TSAnyKeyword");
    });
  });

  describe("a union holding any", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = string | any;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("collapses onto any", ({ keyword }) => {
      expect(keyword).toBe("TSAnyKeyword");
    });
  });

  describe("a union holding unknown", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = string | unknown;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("collapses onto unknown", ({ keyword }) => {
      expect(keyword).toBe("TSUnknownKeyword");
    });
  });

  describe("a union holding both any and unknown", () => {
    const it = test.extend("keyword", () => {
      const declared = parseSync("claim.ts", "type Held = unknown | any;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      const loose = looseTypeNodeOf(declared.typeAnnotation);
      return loose === null ? null : loose.type;
    });

    it("collapses onto any", ({ keyword }) => {
      expect(keyword).toBe("TSAnyKeyword");
    });
  });

  describe("a union of named types", () => {
    const it = test.extend("looseNode", () => {
      const declared = parseSync("claim.ts", "type Held = string | number;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      return looseTypeNodeOf(declared.typeAnnotation);
    });

    it("collapses onto neither", ({ looseNode }) => {
      expect(looseNode).toBe(null);
    });
  });
});

describe("isConcreteTypeClaim", () => {
  describe("a named type", () => {
    const it = test.extend("concreteness", () => {
      const declared = parseSync("claim.ts", "type Held = Row;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      return isConcreteTypeClaim(declared.typeAnnotation);
    });

    it("is a concrete claim", ({ concreteness }) => {
      expect(concreteness).toBe(true);
    });
  });

  describe("a qualified type name", () => {
    const it = test.extend("concreteness", () => {
      const declared = parseSync("claim.ts", "type Held = schema.Row;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      return isConcreteTypeClaim(declared.typeAnnotation);
    });

    it("is a concrete claim", ({ concreteness }) => {
      expect(concreteness).toBe(true);
    });
  });

  describe("the unknown keyword", () => {
    const it = test.extend("concreteness", () => {
      const declared = parseSync("claim.ts", "type Held = unknown;").program
        .body[0] as ESTree.TSTypeAliasDeclaration;
      return isConcreteTypeClaim(declared.typeAnnotation);
    });

    it("claims nothing concrete", ({ concreteness }) => {
      expect(concreteness).toBe(false);
    });
  });

  describe("the const target of a literal assertion", () => {
    const it = test.extend("concreteness", () => {
      const declared = parseSync("claim.ts", "const held = [1, 2] as const;").program
        .body[0] as ESTree.VariableDeclaration;
      const assertion = declared.declarations[0]?.init as ESTree.TSAsExpression;
      return isConcreteTypeClaim(assertion.typeAnnotation);
    });

    it("claims nothing concrete", ({ concreteness }) => {
      expect(concreteness).toBe(false);
    });
  });
});

describe("isTypeAssertion", () => {
  describe("an as expression", () => {
    const it = test.extend("assertion", () => {
      const declared = parseSync("claim.ts", "const held = input as Row;").program
        .body[0] as ESTree.VariableDeclaration;
      return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a type assertion", ({ assertion }) => {
      expect(assertion).toBe(true);
    });
  });

  describe("an angle bracket expression", () => {
    const it = test.extend("assertion", () => {
      const declared = parseSync("claim.ts", "const held = <Row>input;").program
        .body[0] as ESTree.VariableDeclaration;
      return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a type assertion", ({ assertion }) => {
      expect(assertion).toBe(true);
    });
  });

  describe("a satisfies expression", () => {
    const it = test.extend("assertion", () => {
      const declared = parseSync("claim.ts", "const held = input satisfies Row;").program
        .body[0] as ESTree.VariableDeclaration;
      return isTypeAssertion(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("asserts nothing", ({ assertion }) => {
      expect(assertion).toBe(false);
    });
  });
});

describe("unwrappedValueOf", () => {
  describe("parentheses around a name", () => {
    const it = test.extend("shape", () => {
      const declared = parseSync("claim.ts", "const held = (input);").program
        .body[0] as ESTree.VariableDeclaration;
      const written = declared.declarations[0]?.init;
      return written === null || written === undefined ? null : unwrappedValueOf(written).type;
    });

    it("leaves the name standing", ({ shape }) => {
      expect(shape).toBe("Identifier");
    });
  });

  describe("a non null suffix on a name", () => {
    const it = test.extend("shape", () => {
      const declared = parseSync("claim.ts", "const held = input!;").program
        .body[0] as ESTree.VariableDeclaration;
      const written = declared.declarations[0]?.init;
      return written === null || written === undefined ? null : unwrappedValueOf(written).type;
    });

    it("leaves the name standing", ({ shape }) => {
      expect(shape).toBe("Identifier");
    });
  });

  describe("an optional chain onto a member", () => {
    const it = test.extend("shape", () => {
      const declared = parseSync("claim.ts", "const held = input?.row;").program
        .body[0] as ESTree.VariableDeclaration;
      const written = declared.declarations[0]?.init;
      return written === null || written === undefined ? null : unwrappedValueOf(written).type;
    });

    it("leaves the member read standing", ({ shape }) => {
      expect(shape).toBe("MemberExpression");
    });
  });

  describe("a call", () => {
    const it = test.extend("shape", () => {
      const declared = parseSync("claim.ts", "const held = parse(input);").program
        .body[0] as ESTree.VariableDeclaration;
      const written = declared.declarations[0]?.init;
      return written === null || written === undefined ? null : unwrappedValueOf(written).type;
    });

    it("keeps the shape it has", ({ shape }) => {
      expect(shape).toBe("CallExpression");
    });
  });
});

describe("declaredReturnTypeOf", () => {
  describe("a function carrying a return annotation", () => {
    const it = test.extend("shape", () => {
      const declared = parseSync("claim.ts", "function read(): Row { return row; }").program
        .body[0] as ESTree.Statement;
      const annotated = declaredReturnTypeOf(declared);
      return annotated === null ? null : annotated.typeAnnotation.type;
    });

    it("hands back the type it declares", ({ shape }) => {
      expect(shape).toBe("TSTypeReference");
    });
  });

  describe("a function without a return annotation", () => {
    const it = test.extend("annotation", () => {
      const declared = parseSync("claim.ts", "function read() { return row; }").program
        .body[0] as ESTree.Statement;
      return declaredReturnTypeOf(declared);
    });

    it("declares no return type", ({ annotation }) => {
      expect(annotation).toBe(null);
    });
  });

  describe("a statement that returns nothing", () => {
    const it = test.extend("annotation", () => {
      const declared = parseSync("claim.ts", "const held = 1;").program.body[0] as ESTree.Statement;
      return declaredReturnTypeOf(declared);
    });

    it("declares no return type", ({ annotation }) => {
      expect(annotation).toBe(null);
    });
  });
});
