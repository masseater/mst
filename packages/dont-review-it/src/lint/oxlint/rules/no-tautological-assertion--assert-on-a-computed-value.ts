import { isEqual } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { withoutParentheses } from "../lib/parenthesized-expression.ts";
import { staticMemberOf } from "../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";

type FixedValue = { readonly held: unknown };

const EXPECT_NAME = "expect";

const EQUALITY_MATCHER_NAMES: ReadonlySet<string> = new Set(["toBe", "toEqual", "toStrictEqual"]);

const MODIFIER_NAMES: ReadonlySet<string> = new Set(["not", "resolves", "rejects"]);

const fixedValueOf = (expression: ESTree.Expression): FixedValue | null => {
  const written = withoutParentheses(expression);

  if (written.type === "Literal") {
    return "regex" in written ? null : { held: written.value };
  }
  if (written.type === "TemplateLiteral") {
    return written.expressions.length === 0 ? { held: written.quasis[0].value.cooked } : null;
  }
  if (written.type !== "UnaryExpression" || written.operator !== "-") return null;

  const negated = fixedValueOf(written.argument);
  if (negated === null || typeof negated.held !== "number") return null;
  return { held: -negated.held };
};

const subjectOfExpect = (expression: ESTree.Expression): ESTree.Expression | null => {
  const asserted = withoutParentheses(expression);

  if (asserted.type === "CallExpression") {
    const callee = withoutParentheses(asserted.callee);
    if (callee.type !== "Identifier" || callee.name !== EXPECT_NAME) return null;
    if (asserted.arguments.length !== 1) return null;
    const [subject] = asserted.arguments;
    return subject.type === "SpreadElement" ? null : subject;
  }

  const member = staticMemberOf(asserted);
  if (member === null || !MODIFIER_NAMES.has(member.name)) return null;
  return subjectOfExpect(member.object);
};

const equalityOperandsOf = (
  node: ESTree.CallExpression,
): { readonly expectedNode: ESTree.Expression; readonly subjectNode: ESTree.Expression } | null => {
  const matcher = staticMemberOf(node.callee);
  if (matcher === null || !EQUALITY_MATCHER_NAMES.has(matcher.name)) return null;
  if (node.arguments.length !== 1) return null;

  const [expectedNode] = node.arguments;
  if (expectedNode.type === "SpreadElement") return null;

  const subjectNode = subjectOfExpect(matcher.object);
  return subjectNode === null ? null : { expectedNode, subjectNode };
};

const isTautologicalAssertion = (node: ESTree.CallExpression): boolean => {
  const operands = equalityOperandsOf(node);
  if (operands === null) return false;

  const expected = fixedValueOf(operands.expectedNode);
  const subject = fixedValueOf(operands.subjectNode);
  if (expected === null || subject === null) return false;
  return isEqual(expected.held, subject.held);
};

export const noTautologicalAssertion = createDontReviewItRule({
  name: "no-tautological-assertion--assert-on-a-computed-value",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an equality assertion whose expected value and whose subject are the same written-out literal, so every assertion in the suite compares something the code under test produced",
      relatedGuidelines: [],
    },
    messages: {
      tautologicalAssertion:
        "An equality assertion must not compare a written-out literal against the same written-out literal, because both sides are decided by this file alone: no function under test runs, no behaviour is observed, and the assertion returns the same verdict whatever the rest of the program does. A green suite full of these reports coverage it does not have, and the case stays green through the change that breaks the thing it was named after. Put the subject the test is about on the left: call the function under test and assert on what it returned, read the state the operation left behind, or assert on the argument a collaborator was called with. If nothing the test could call produces this value, the case has no subject and the value it should assert on has to be found before the case is worth keeping.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isTautologicalAssertion(node)) return;
        context.report({ node, messageId: "tautologicalAssertion" });
      },
    };
  },
});
