import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noTautologicalAssertion } from "./no-tautological-assertion--assert-on-a-computed-value.ts";

describe("dont-review-it/no-tautological-assertion--assert-on-a-computed-value", () => {
  testLintRule(noTautologicalAssertion, {
    valid: [
      {
        name: "asserting on what the function under test returned passes",
        documented: true,
        code: "expect(total(1, 2)).toBe(3);",
      },
      {
        name: "asserting on a binding passes because the binding was computed elsewhere",
        code: "expect(parsed).toBe(3);",
      },
      {
        name: "a matcher reached through a computed name is not read as a matcher",
        code: "expect(1)['toBe'](1);",
      },
      {
        name: "a matcher handed more than one argument is not an equality assertion",
        code: "expect(1).toBe(1, 1);",
      },
      {
        name: "a matcher handed a spread has no written out expected value",
        code: "expect(1).toBe(...expected);",
      },
      {
        name: "a call to expect handed a spread has no written out subject",
        code: "expect(...given).toBe(1);",
      },
      {
        name: "a matcher called on a plain binding has no call to expect behind it",
        code: "assertion.toBe(1);",
      },
      {
        name: "a matcher reached through something other than a modifier is left alone",
        code: "suite.assertion.toBe(1);",
      },
      {
        name: "negating something that is not a written out number leaves no fixed value",
        code: "expect(-computed).toBe(-computed);",
      },
      {
        name: "negating a written out string is not a written out number",
        code: "expect(-'1').toBe(-'1');",
      },
      {
        name: "a private method call is not read as a matcher",
        code: "class Suite { #toBe(expected) { return expected; } run() { this.#toBe(1); } }",
      },
      {
        name: "two different literals compare something even if the code never runs",
        documented: true,
        code: "expect(1).toBe(2);",
      },
      {
        name: "a string and a number of the same spelling are not the same value",
        code: "expect('1').toBe(1);",
      },
      {
        name: "a template literal carrying an expression is not a written out literal",
        code: "expect(`total: ${total}`).toBe('total: 3');",
      },
      {
        name: "a matcher that is not an equality matcher is outside this rule",
        code: "expect(1).toBeDefined();",
      },
      {
        name: "an equality matcher on a receiver that is not expect is outside this rule",
        code: "assertion(1).toBe(1);",
      },
      {
        name: "an object literal compared with itself is outside the literal comparison",
        code: "expect({ total: 1 }).toEqual({ total: 1 });",
      },
      {
        name: "two regular expressions written out are compared by reference and can fail",
        code: "expect(/a/).toEqual(/a/);",
      },
      {
        name: "expect called with more than one value is a different call",
        code: "expect(1, 'total').toBe(1);",
      },
      {
        name: "a matcher given more than one value is a different call",
        code: "expect(1).toBeCloseTo(1, 5);",
      },
    ],
    invalid: [
      {
        name: "a number compared with the same number is reported",
        documented: true,
        code: "expect(1).toBe(1);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "a string compared with the same string is reported",
        code: "expect('parsed').toBe('parsed');",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "a boolean compared with the same boolean is reported",
        code: "expect(true).toBe(true);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "null compared with null is reported",
        code: "expect(null).toBe(null);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "toEqual carries the same defect as toBe",
        code: "expect(1).toEqual(1);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "toStrictEqual carries the same defect as toBe",
        code: "expect('parsed').toStrictEqual('parsed');",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "the same value written two ways is still the same value",
        documented: true,
        code: "expect(1).toBe(1.0);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "a template literal without expressions is a written out string",
        code: "expect(`parsed`).toBe('parsed');",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "a negative number compared with the same negative number is reported",
        code: "expect(-1).toBe(-1);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "the not modifier gives a verdict that is just as fixed",
        code: "expect(1).not.toBe(1);",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "parentheses around either side do not change the comparison",
        code: "expect((1)).toBe((1));",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "each assertion in a case is reported on its own",
        code: "expect(1).toBe(1);\nexpect('a').toBe('a');",
        errors: [{ messageId: "tautologicalAssertion" }, { messageId: "tautologicalAssertion" }],
      },
      {
        name: "an assertion written inside a test callback is reported",
        code: "it('adds', () => {\n  expect(3).toBe(3);\n});",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
      {
        name: "a file outside the test suffix carries no exemption",
        code: "expect(1).toBe(1);",
        filename: "/repo/packages/repository-checks/src/total.ts",
        errors: [{ messageId: "tautologicalAssertion" }],
      },
    ],
  });
});
