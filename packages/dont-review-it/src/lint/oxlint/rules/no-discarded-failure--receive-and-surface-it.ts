import { createDontReviewItRule } from "../../../create-rule.ts";
import { VOID_OPERATOR } from "../lib/void-operator.ts";

import type { ESTree } from "@oxlint/plugins";

const FAILURE_PAIR_CALLEE_NAMES: ReadonlySet<string> = new Set(["attempt", "attemptAsync"]);

const CARRIED_THROUGH_TYPES: ReadonlySet<string> = new Set([
  "AwaitExpression",
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const FAILURE_ELEMENT_INDEX = 0;

const RESULT_ELEMENT_INDEX = 1;

const PLACEHOLDER_NAME_PATTERN = /^_+$/u;

const bindsFailureKey = (property: ESTree.BindingProperty | ESTree.BindingRestElement): boolean => {
  if (property.type === "RestElement") return true;
  if (property.computed) return true;
  if (property.key.type !== "Literal") return true;
  return property.key.value === FAILURE_ELEMENT_INDEX || property.key.value === "0";
};

const bindsFailure = (binding: ESTree.BindingPattern | ESTree.BindingRestElement): boolean => {
  if (binding.type === "Identifier") return !PLACEHOLDER_NAME_PATTERN.test(binding.name);
  if (binding.type === "ObjectPattern") return binding.properties.some(bindsFailureKey);
  if (binding.type !== "ArrayPattern") return true;

  const [failureElement] = binding.elements;
  return failureElement === null || failureElement === undefined
    ? false
    : bindsFailure(failureElement);
};

const readsResultElement = (member: ESTree.MemberExpression): boolean =>
  member.computed &&
  member.property.type === "Literal" &&
  member.property.value === RESULT_ELEMENT_INDEX;

const receiverOf = (node: ESTree.Node): ESTree.Node => {
  const parent = node.parent as ESTree.Node;
  return CARRIED_THROUGH_TYPES.has(parent.type) ? receiverOf(parent) : parent;
};

const discardsFailure = (node: ESTree.CallExpression): boolean => {
  const receiver = receiverOf(node);
  if (receiver.type === "ExpressionStatement") return true;
  if (receiver.type === "UnaryExpression") return receiver.operator === VOID_OPERATOR;
  if (receiver.type === "VariableDeclarator") return !bindsFailure(receiver.id);
  if (receiver.type === "MemberExpression") return readsResultElement(receiver);
  return false;
};

export const noDiscardedFailure = createDontReviewItRule({
  name: "no-discarded-failure--receive-and-surface-it",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow taking the result of a call that returns a failure and a value as a pair without binding the failure, and disallow a catch clause that names nothing, so a failure reaches a place that can act on it instead of turning into the value that stands for its own absence",
      relatedGuidelines: [],
    },
    messages: {
      discardedFailurePair:
        "The failure half of this pair must not be dropped. Bind the failure and decide at this call what it means: keep a normal absence as a value selected by the failure's `code`, and throw for every other failure with the original passed as `cause`.",
      unnamedCatchFailure:
        "A catch clause must not leave what it caught unbound. Bind the failure and pick an ending the caller can act on: rethrow it, throw one that names this layer's part in it with the original as `cause`, or return a value that shows the operation did not complete.",
    },
    schema: [],
  },
  create(context) {
    return {
      CatchClause(node: ESTree.CatchClause) {
        if (node.param !== null && bindsFailure(node.param)) return;

        context.report({ node, messageId: "unnamedCatchFailure" });
      },
      CallExpression(node: ESTree.CallExpression) {
        if (node.callee.type !== "Identifier") return;
        if (!FAILURE_PAIR_CALLEE_NAMES.has(node.callee.name)) return;
        if (!discardsFailure(node)) return;

        context.report({ node, messageId: "discardedFailurePair" });
      },
    };
  },
});
