import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { comparedOperandsOf, unwrapCopiedValue } from "./compared-operands.ts";

import type { ESTree } from "@oxlint/plugins";

describe("comparedOperandsOf", () => {
  describe("a matcher comparing a subject against one expected value", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'expect(report).toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over the subject and the expected value", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "report",
          optional: false,
          typeAnnotation: null,
          start: 7,
          end: 13,
        },
        expectations: [{ type: "Literal", value: "a", raw: '"a"', start: 20, end: 23 }],
      });
    });
  });

  describe("a matcher that takes no expected value", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", "expect(report).toBeTruthy();").program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over the subject alone", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "report",
          optional: false,
          typeAnnotation: null,
          start: 7,
          end: 13,
        },
        expectations: [],
      });
    });
  });

  describe("a matcher that takes several expected values", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", "expect(mock).toHaveBeenNthCalledWith(1, sent);").program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over every expected value", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "mock",
          optional: false,
          typeAnnotation: null,
          start: 7,
          end: 11,
        },
        expectations: [
          { type: "Literal", value: 1, raw: "1", start: 37, end: 38 },
          {
            type: "Identifier",
            decorators: [],
            name: "sent",
            optional: false,
            typeAnnotation: null,
            start: 40,
            end: 44,
          },
        ],
      });
    });
  });

  describe("a matcher handed a spread expected value", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", "expect(report).toStrictEqual(...expected);").program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over what the spread spreads", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "report",
          optional: false,
          typeAnnotation: null,
          start: 7,
          end: 13,
        },
        expectations: [
          {
            type: "Identifier",
            decorators: [],
            name: "expected",
            optional: false,
            typeAnnotation: null,
            start: 32,
            end: 40,
          },
        ],
      });
    });
  });

  describe("a matcher standing behind a run of modifiers", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'expect(pending).resolves.not.toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("reaches the subject through the modifiers", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "pending",
          optional: false,
          typeAnnotation: null,
          start: 7,
          end: 14,
        },
        expectations: [{ type: "Literal", value: "a", raw: '"a"', start: 34, end: 37 }],
      });
    });
  });

  describe("a matcher standing behind a derived receiver", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'expect.soft(report).toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("reaches the subject through the derived receiver", ({ operands }) => {
      expect(operands).toStrictEqual({
        subject: {
          type: "Identifier",
          decorators: [],
          name: "report",
          optional: false,
          typeAnnotation: null,
          start: 12,
          end: 18,
        },
        expectations: [{ type: "Literal", value: "a", raw: '"a"', start: 25, end: 28 }],
      });
    });
  });

  describe("a matcher carried by another receiver", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'checker.toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over nothing", ({ operands }) => {
      expect(operands).toBe(null);
    });
  });

  describe("an entry handed a spread", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'expect(...handed).toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over nothing", ({ operands }) => {
      expect(operands).toBe(null);
    });
  });

  describe("an entry handed nothing", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'expect().toBe("a");').program
        .body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over nothing", ({ operands }) => {
      expect(operands).toBe(null);
    });
  });

  describe("a call that reaches no matcher through a receiver", () => {
    const it = test.extend("operands", () => {
      const written = parseSync("spec.ts", 'runSut("a");').program.body[0] as ESTree.Statement;
      const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return comparedOperandsOf(call);
    });

    it("hands over nothing", ({ operands }) => {
      expect(operands).toBe(null);
    });
  });
});

describe("unwrapCopiedValue", () => {
  describe("an object that only spreads one value", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", "({ ...report });").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("reaches through to the value it spreads", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "Identifier",
        decorators: [],
        name: "report",
        optional: false,
        typeAnnotation: null,
        start: 6,
        end: 12,
      });
    });
  });

  describe("an array that only spreads one value", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", "[...ids];").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("reaches through to the value it spreads", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "Identifier",
        decorators: [],
        name: "ids",
        optional: false,
        typeAnnotation: null,
        start: 4,
        end: 7,
      });
    });
  });

  describe("a copy of a copy", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", "({ ...{ ...report } });").program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("reaches through both copies", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "Identifier",
        decorators: [],
        name: "report",
        optional: false,
        typeAnnotation: null,
        start: 11,
        end: 17,
      });
    });
  });

  describe("a shape that overrides part of what it spreads", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", '({ ...report, id: "a" });').program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("stops at the shape", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "ObjectExpression",
        properties: [
          {
            type: "SpreadElement",
            argument: {
              type: "Identifier",
              decorators: [],
              name: "report",
              optional: false,
              typeAnnotation: null,
              start: 6,
              end: 12,
            },
            start: 3,
            end: 12,
          },
          {
            type: "Property",
            kind: "init",
            key: {
              type: "Identifier",
              decorators: [],
              name: "id",
              optional: false,
              typeAnnotation: null,
              start: 14,
              end: 16,
            },
            value: { type: "Literal", value: "a", raw: '"a"', start: 18, end: 21 },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 14,
            end: 21,
          },
        ],
        start: 1,
        end: 23,
      });
    });
  });

  describe("a shape written out without a spread", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", '({ id: "a" });').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("stops at the shape", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            kind: "init",
            key: {
              type: "Identifier",
              decorators: [],
              name: "id",
              optional: false,
              typeAnnotation: null,
              start: 3,
              end: 5,
            },
            value: { type: "Literal", value: "a", raw: '"a"', start: 7, end: 10 },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 3,
            end: 10,
          },
        ],
        start: 1,
        end: 12,
      });
    });
  });

  describe("a value that is no copy at all", () => {
    const it = test.extend("unwrapped", () => {
      const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
      return unwrapCopiedValue(inner);
    });

    it("hands the value back", ({ unwrapped }) => {
      expect(unwrapped).toStrictEqual({
        type: "Identifier",
        decorators: [],
        name: "report",
        optional: false,
        typeAnnotation: null,
        start: 0,
        end: 6,
      });
    });
  });
});
