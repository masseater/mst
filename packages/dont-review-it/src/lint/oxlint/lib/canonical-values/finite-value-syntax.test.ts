import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  calleeMemberName,
  isFiniteVocabulary,
  literalUnionValues,
  propertyKeyName,
  schemaUnionLiterals,
  staticArrayValues,
  unwrapType,
} from "./finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

describe("isFiniteVocabulary", () => {
  describe("two distinct spellings", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft", "published"]));

    it("are a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("one spelling", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft"]));

    it("names a single value rather than a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("the same spelling repeated", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary(["draft", "draft"]));

    it("is still one value", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("both booleans spelled out", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([true, false]));

    it("are the two sides of a flag, not a vocabulary", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a boolean beside a spelling", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([true, "draft"]));

    it("is a vocabulary because the flag is not the whole set", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a number and the same digits written as text", () => {
    const it = test.extend("verdict", () => isFiniteVocabulary([1, "1"]));

    it("are two values", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });
});

describe("staticArrayValues", () => {
  describe("an array of two spellings", () => {
    const it = test.extend("spellings", () => {
      const source = '["draft", "published"];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("reads both spellings in the order they were written", ({ spellings }) => {
      expect(spellings).toStrictEqual(["draft", "published"]);
    });
  });

  describe("a negated number, a plus-signed number, and a template without substitutions", () => {
    const it = test.extend("spellings", () => {
      const source = "[-1, +2, `draft`];";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("reads each one as the scalar it spells", ({ spellings }) => {
      expect(spellings).toStrictEqual([-1, 2, "draft"]);
    });
  });

  describe("null written beside a boolean and a spelling", () => {
    const it = test.extend("spellings", () => {
      const source = '[null, true, "draft"];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("keeps null as a member of the vocabulary", ({ spellings }) => {
      expect(spellings).toStrictEqual([null, true, "draft"]);
    });
  });

  describe("a negated spelling", () => {
    const it = test.extend("spellings", () => {
      const source = '[-"draft", "published"];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("leaves the array without a finite reading", ({ spellings }) => {
      expect(spellings).toBe(null);
    });
  });

  describe("a regular expression among the members", () => {
    const it = test.extend("spellings", () => {
      const source = '[/draft/u, "published"];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("leaves the array without a finite reading", ({ spellings }) => {
      expect(spellings).toBe(null);
    });
  });

  describe("a hole between two spellings", () => {
    const it = test.extend("spellings", () => {
      const source = '["draft", , "published"];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("leaves the array without a finite reading", ({ spellings }) => {
      expect(spellings).toBe(null);
    });
  });

  describe("a spread among the members", () => {
    const it = test.extend("spellings", () => {
      const source = '["draft", ...spellings];';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return staticArrayValues(statement.expression as ESTree.ArrayExpression);
    });

    it("leaves the array without a finite reading", ({ spellings }) => {
      expect(spellings).toBe(null);
    });
  });
});

describe("literalUnionValues", () => {
  describe("a union holding the null keyword", () => {
    const it = test.extend("unionSpellings", () => {
      const source = 'type Status = "draft" | null | "published";';
      const syntaxTree = parseSync("catalog.ts", source);
      const declared = syntaxTree.program.body[0] as ESTree.TSTypeAliasDeclaration;
      return literalUnionValues(declared.typeAnnotation);
    });

    it("keeps null among the spellings", ({ unionSpellings }) => {
      expect(unionSpellings).toStrictEqual(["draft", null, "published"]);
    });
  });

  describe("a union holding the undefined keyword", () => {
    const it = test.extend("unionSpellings", () => {
      const source = 'type Status = "draft" | undefined | "published";';
      const syntaxTree = parseSync("catalog.ts", source);
      const declared = syntaxTree.program.body[0] as ESTree.TSTypeAliasDeclaration;
      return literalUnionValues(declared.typeAnnotation);
    });

    it("leaves the union without a finite reading", ({ unionSpellings }) => {
      expect(unionSpellings).toBe(null);
    });
  });

  describe("a union holding a template type with a substitution", () => {
    const it = test.extend("unionSpellings", () => {
      const source = 'type Status = `draft-${string}` | "published";';
      const syntaxTree = parseSync("catalog.ts", source);
      const declared = syntaxTree.program.body[0] as ESTree.TSTypeAliasDeclaration;
      return literalUnionValues(declared.typeAnnotation);
    });

    it("leaves the union without a finite reading", ({ unionSpellings }) => {
      expect(unionSpellings).toBe(null);
    });
  });

  describe("a type alias that spells a single literal", () => {
    const it = test.extend("unionSpellings", () => {
      const source = 'type Status = "draft";';
      const syntaxTree = parseSync("catalog.ts", source);
      const declared = syntaxTree.program.body[0] as ESTree.TSTypeAliasDeclaration;
      return literalUnionValues(declared.typeAnnotation);
    });

    it("is not a union and so has no spellings to read", ({ unionSpellings }) => {
      expect(unionSpellings).toBe(null);
    });
  });
});

describe("unwrapType", () => {
  describe("a union written inside parentheses", () => {
    const it = test.extend("unwrappedType", () => {
      const source = 'type Status = ("draft" | "published");';
      const syntaxTree = parseSync("catalog.ts", source);
      const declared = syntaxTree.program.body[0] as ESTree.TSTypeAliasDeclaration;
      return unwrapType(declared.typeAnnotation);
    });

    it("reads through the parentheses to the union", ({ unwrappedType }) => {
      expect(unwrappedType).toStrictEqual({
        type: "TSUnionType",
        types: [
          {
            type: "TSLiteralType",
            literal: { type: "Literal", value: "draft", raw: '"draft"', start: 15, end: 22 },
            start: 15,
            end: 22,
          },
          {
            type: "TSLiteralType",
            literal: {
              type: "Literal",
              value: "published",
              raw: '"published"',
              start: 25,
              end: 36,
            },
            start: 25,
            end: 36,
          },
        ],
        start: 15,
        end: 36,
      });
    });
  });
});

describe("propertyKeyName", () => {
  describe("a key written as a bare identifier", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { enum: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("is named by the identifier", ({ keyName }) => {
      expect(keyName).toBe("enum");
    });
  });

  describe("a computed key written as a string", () => {
    const it = test.extend("keyName", () => {
      const source = 'const schema = { ["enum"]: [] };';
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("is named by the string it spells", ({ keyName }) => {
      expect(keyName).toBe("enum");
    });
  });

  describe("a computed key written as a number", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [1]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("is named by the digits it spells", ({ keyName }) => {
      expect(keyName).toBe("1");
    });
  });

  describe("a computed key written as a template without substitutions", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [`enum`]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("is named by the text between the backticks", ({ keyName }) => {
      expect(keyName).toBe("enum");
    });
  });

  describe("a computed key written as a template with a substitution", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [`${member}`]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("cannot be named from the syntax alone", ({ keyName }) => {
      expect(keyName).toBe(null);
    });
  });

  describe("a computed key written as a regular expression", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [/enum/u]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("cannot be named from the syntax alone", ({ keyName }) => {
      expect(keyName).toBe(null);
    });
  });

  describe("a computed key written as a boolean", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [true]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("cannot be named from the syntax alone", ({ keyName }) => {
      expect(keyName).toBe(null);
    });
  });

  describe("a computed key read through another object", () => {
    const it = test.extend("keyName", () => {
      const source = "const schema = { [members.enum]: [] };";
      const syntaxTree = parseSync("catalog.ts", source);
      const declaration = syntaxTree.program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const [property] = (declarator.init as ESTree.ObjectExpression).properties;
      return propertyKeyName((property as ESTree.ObjectProperty).key);
    });

    it("cannot be named from the syntax alone", ({ keyName }) => {
      expect(keyName).toBe(null);
    });
  });
});

describe("calleeMemberName", () => {
  describe("a call on a member reached with a dot", () => {
    const it = test.extend("memberName", () => {
      const source = "schema.enum([]);";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return calleeMemberName((statement.expression as ESTree.CallExpression).callee);
    });

    it("names the member that was called", ({ memberName }) => {
      expect(memberName).toBe("enum");
    });
  });

  describe("a call on a member reached with an optional call", () => {
    const it = test.extend("memberName", () => {
      const source = "schema.enum?.([]);";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      const chained = statement.expression as ESTree.ChainExpression;
      return calleeMemberName((chained.expression as ESTree.CallExpression).callee);
    });

    it("names the member that was called", ({ memberName }) => {
      expect(memberName).toBe("enum");
    });
  });

  describe("a call on a member reached with a subscript", () => {
    const it = test.extend("memberName", () => {
      const source = 'schema["enum"]([]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return calleeMemberName((statement.expression as ESTree.CallExpression).callee);
    });

    it("cannot be named from the syntax alone", ({ memberName }) => {
      expect(memberName).toBe(null);
    });
  });

  describe("a bare name standing on its own", () => {
    const it = test.extend("memberName", () => {
      const source = "schema;";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return calleeMemberName(statement.expression);
    });

    it("names no member at all", ({ memberName }) => {
      expect(memberName).toBe(null);
    });
  });
});

describe("schemaUnionLiterals", () => {
  describe("a union of literal calls", () => {
    const it = test.extend("unionSpellings", () => {
      const source = 'z.union([z.literal("draft"), z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      const literals = schemaUnionLiterals(statement.expression as ESTree.CallExpression);
      return literals === null ? null : literals.values;
    });

    it("reads the spelling each literal carries", ({ unionSpellings }) => {
      expect(unionSpellings).toStrictEqual(["draft", "published"]);
    });
  });

  describe("a union call handed nothing", () => {
    const it = test.extend("unionLiterals", () => {
      const source = "z.union();";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union call spread into its arguments", () => {
    const it = test.extend("unionLiterals", () => {
      const source = "z.union(...members);";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union call handed a name instead of an array", () => {
    const it = test.extend("unionLiterals", () => {
      const source = "z.union(members);";
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union whose members include a bare spelling", () => {
    const it = test.extend("unionLiterals", () => {
      const source = 'z.union(["draft", z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union whose members include a hole", () => {
    const it = test.extend("unionLiterals", () => {
      const source = 'z.union([, z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union whose members reach literal through a subscript", () => {
    const it = test.extend("unionLiterals", () => {
      const source = 'z.union([z["literal"]("draft"), z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union whose members include a literal call handed nothing", () => {
    const it = test.extend("unionLiterals", () => {
      const source = 'z.union([z.literal(), z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });

  describe("a union whose members include a literal call spread into its argument", () => {
    const it = test.extend("unionLiterals", () => {
      const source = 'z.union([z.literal(...spellings), z.literal("published")]);';
      const syntaxTree = parseSync("catalog.ts", source);
      const statement = syntaxTree.program.body[0] as ESTree.ExpressionStatement;
      return schemaUnionLiterals(statement.expression as ESTree.CallExpression);
    });

    it("leaves the call without a finite reading", ({ unionLiterals }) => {
      expect(unionLiterals).toBe(null);
    });
  });
});
