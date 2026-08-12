import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { comparedOperandsOf, unwrapCopiedValue } from "./compared-operands.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("operandsOfPlainComparison", () => {
    const written = parseSync("spec.ts", 'expect(report).toBe("a");').program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfValuelessMatcher", () => {
    const written = parseSync("spec.ts", "expect(report).toBeTruthy();").program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfManyValuedMatcher", () => {
    const written = parseSync("spec.ts", "expect(mock).toHaveBeenNthCalledWith(1, sent);").program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfSpreadExpectation", () => {
    const written = parseSync("spec.ts", "expect(report).toStrictEqual(...expected);").program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsBehindModifiers", () => {
    const written = parseSync("spec.ts", 'expect(pending).resolves.not.toBe("a");').program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsBehindDerivedReceiver", () => {
    const written = parseSync("spec.ts", 'expect.soft(report).toBe("a");').program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfForeignReceiver", () => {
    const written = parseSync("spec.ts", 'checker.toBe("a");').program.body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfSpreadEntry", () => {
    const written = parseSync("spec.ts", 'expect(...handed).toBe("a");').program
      .body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfEmptyEntry", () => {
    const written = parseSync("spec.ts", 'expect().toBe("a");').program.body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("operandsOfCallWithoutAReceiver", () => {
    const written = parseSync("spec.ts", 'runSut("a");').program.body[0] as ESTree.Statement;
    const call = (written as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return comparedOperandsOf(call);
  })
  .extend("valueBehindObjectCopy", () => {
    const written = parseSync("spec.ts", "({ ...report });").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  })
  .extend("valueBehindArrayCopy", () => {
    const written = parseSync("spec.ts", "[...ids];").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  })
  .extend("valueBehindNestedCopy", () => {
    const written = parseSync("spec.ts", "({ ...{ ...report } });").program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  })
  .extend("valueOfOverridingShape", () => {
    const written = parseSync("spec.ts", '({ ...report, id: "a" });').program
      .body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  })
  .extend("valueOfSpreadlessShape", () => {
    const written = parseSync("spec.ts", '({ id: "a" });').program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  })
  .extend("valueOfUncopiedValue", () => {
    const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
    const bare = (written as ESTree.ExpressionStatement).expression;
    const inner = bare.type === "ParenthesizedExpression" ? bare.expression : bare;
    return unwrapCopiedValue(inner);
  });

describe("comparedOperandsOf", () => {
  it("hands over the subject and the expected value a matcher compares", ({
    operandsOfPlainComparison,
  }) => {
    expect(operandsOfPlainComparison).toStrictEqual({
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

  it("hands over the subject alone for a matcher that takes no expected value", ({
    operandsOfValuelessMatcher,
  }) => {
    expect(operandsOfValuelessMatcher).toStrictEqual({
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

  it("hands over every expected value a matcher takes", ({ operandsOfManyValuedMatcher }) => {
    expect(operandsOfManyValuedMatcher).toStrictEqual({
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

  it("hands over what a spread expected value spreads", ({ operandsOfSpreadExpectation }) => {
    expect(operandsOfSpreadExpectation).toStrictEqual({
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

  it("reaches the subject through a run of modifiers", ({ operandsBehindModifiers }) => {
    expect(operandsBehindModifiers).toStrictEqual({
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

  it("reaches the subject through a derived receiver", ({ operandsBehindDerivedReceiver }) => {
    expect(operandsBehindDerivedReceiver).toStrictEqual({
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

  it("hands over nothing for a matcher carried by another receiver", ({
    operandsOfForeignReceiver,
  }) => {
    expect(operandsOfForeignReceiver).toBe(null);
  });

  it("hands over nothing when the entry was handed a spread", ({ operandsOfSpreadEntry }) => {
    expect(operandsOfSpreadEntry).toBe(null);
  });

  it("hands over nothing when the entry was handed nothing", ({ operandsOfEmptyEntry }) => {
    expect(operandsOfEmptyEntry).toBe(null);
  });

  it("hands over nothing for a call that reaches no matcher through a receiver", ({
    operandsOfCallWithoutAReceiver,
  }) => {
    expect(operandsOfCallWithoutAReceiver).toBe(null);
  });
});

describe("unwrapCopiedValue", () => {
  it("reaches through an object that only spreads one value", ({ valueBehindObjectCopy }) => {
    expect(valueBehindObjectCopy).toStrictEqual({
      type: "Identifier",
      decorators: [],
      name: "report",
      optional: false,
      typeAnnotation: null,
      start: 6,
      end: 12,
    });
  });

  it("reaches through an array that only spreads one value", ({ valueBehindArrayCopy }) => {
    expect(valueBehindArrayCopy).toStrictEqual({
      type: "Identifier",
      decorators: [],
      name: "ids",
      optional: false,
      typeAnnotation: null,
      start: 4,
      end: 7,
    });
  });

  it("reaches through a copy of a copy", ({ valueBehindNestedCopy }) => {
    expect(valueBehindNestedCopy).toStrictEqual({
      type: "Identifier",
      decorators: [],
      name: "report",
      optional: false,
      typeAnnotation: null,
      start: 11,
      end: 17,
    });
  });

  it("stops at a shape that overrides part of what it spreads", ({ valueOfOverridingShape }) => {
    expect(valueOfOverridingShape).toStrictEqual({
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

  it("stops at a shape written out without a spread", ({ valueOfSpreadlessShape }) => {
    expect(valueOfSpreadlessShape).toStrictEqual({
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

  it("hands back a value that is no copy at all", ({ valueOfUncopiedValue }) => {
    expect(valueOfUncopiedValue).toStrictEqual({
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
