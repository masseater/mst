import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedValues, partsOf } from "./expression-parts.ts";

import type { ESTree } from "@oxlint/plugins";

describe("partsOf", () => {
  describe("a call on a member", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "summarise(input).sort(order);").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its receiver and its arguments", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["CallExpression", "Identifier"]);
    });
  });

  describe("a call on a bare name", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "summarise(input);").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its arguments alone", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a construction", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "new Report(input);").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its arguments", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a member access written with a dot", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "summarise(input).rows;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over what it reads through", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["CallExpression"]);
    });
  });

  describe("a member access written as a subscript", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "summarise(input)[key];").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over what it reads through", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["CallExpression"]);
    });
  });

  describe("a tagged template", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "sql`${input}`;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its tag and its substitutions", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier"]);
    });
  });

  describe("a template", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "`${input}`;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its substitutions", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a collection", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "[, input, ...rest];").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over its elements, spreads included and holes dropped", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier"]);
    });
  });

  describe("an object", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "({ rows: input, ...rest });").program
        .body[0] as ESTree.ExpressionStatement;
      const bare = statement.expression;
      const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return partsOf(written).map((part) => part.type);
    });

    it("hands over its values, spreads included", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier"]);
    });
  });

  describe("a choice", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "empty ? left : right;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over the question and both answers", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier", "Identifier"]);
    });
  });

  describe("a comparison", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "left + right;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over both sides", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier"]);
    });
  });

  describe("a comparison against a private name", () => {
    const it = test.extend("handedOverTypes", () => {
      const declared = parseSync(
        "spec.ts",
        "class Reports {\n  #brand;\n  held = #brand in input;\n}",
      ).program.body[0] as ESTree.Class;
      const written = declared.body.body[1] as ESTree.PropertyDefinition;
      return partsOf(written.value as ESTree.Expression).map((part) => part.type);
    });

    it("hands over the side that holds a value", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a fallback", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "cached ?? produced;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over both sides", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier", "Identifier"]);
    });
  });

  describe("a sequence", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "(record(), produced);").program
        .body[0] as ESTree.ExpressionStatement;
      const bare = statement.expression;
      const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return partsOf(written).map((part) => part.type);
    });

    it("hands over every step", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["CallExpression", "Identifier"]);
    });
  });

  describe("an operator applied to one value", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "-produced;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands that value over", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("an assignment", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "(carried = produced);").program
        .body[0] as ESTree.ExpressionStatement;
      const bare = statement.expression;
      const written = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return partsOf(written).map((part) => part.type);
    });

    it("hands over what is being written", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a pair of parentheses", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "(produced);").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("hands over what it wraps", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual(["Identifier"]);
    });
  });

  describe("a string written out", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", '"a";').program.body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("carries nothing further and hands over nothing", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual([]);
    });
  });

  describe("a bare name", () => {
    const it = test.extend("handedOverTypes", () => {
      const statement = parseSync("spec.ts", "produced;").program
        .body[0] as ESTree.ExpressionStatement;
      return partsOf(statement.expression).map((part) => part.type);
    });

    it("carries nothing further and hands over nothing", ({ handedOverTypes }) => {
      expect(handedOverTypes).toStrictEqual([]);
    });
  });
});

describe("handedValues", () => {
  describe("a list holding no element", () => {
    const it = test.extend("handedOverValues", () => handedValues([]));

    it("drops holes and unwraps spreads and hands over nothing", ({ handedOverValues }) => {
      expect(handedOverValues).toStrictEqual([]);
    });
  });
});
