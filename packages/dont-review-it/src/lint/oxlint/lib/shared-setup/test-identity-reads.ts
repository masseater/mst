import { staticMemberName } from "../spec-syntax/static-names.ts";

import type { ESTree } from "@oxlint/plugins";

export const TEST_IDENTIFYING_NAMES: ReadonlySet<string> = new Set([
  "currentSuite",
  "currentTest",
  "currentTestName",
  "filepath",
  "fullName",
  "suite",
  "suiteName",
  "tags",
  "task",
  "testName",
  "testPath",
]);

const TYPE_NODE_PREFIX = "TS";

const VALUE_CARRYING_TYPE_NODES: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

const standsInTypePosition = (node: ESTree.Node): boolean =>
  node.type.startsWith(TYPE_NODE_PREFIX) && !VALUE_CARRYING_TYPE_NODES.has(node.type);

const branchesOn = (parent: ESTree.Node, held: ESTree.Node): boolean => {
  if (parent.type === "IfStatement") return parent.test === held;
  if (parent.type === "ConditionalExpression") return parent.test === held;
  if (parent.type === "SwitchStatement") return parent.discriminant === held;
  if (parent.type === "SwitchCase") return parent.test === held;
  return parent.type === "LogicalExpression";
};

export const handsOverValue = (
  node: ESTree.Node,
): node is ESTree.CallExpression | ESTree.NewExpression =>
  node.type === "CallExpression" || node.type === "NewExpression";

const handsOver = (parent: ESTree.Node, held: ESTree.Node): boolean =>
  handsOverValue(parent) && parent.arguments.some((handed) => handed === held);

export const steeringHolderOf = (node: ESTree.Node): ESTree.Node | null => {
  const { parent } = node;
  if (parent === null || standsInTypePosition(parent)) return null;
  if (branchesOn(parent, node) || handsOver(parent, node)) return parent;
  return steeringHolderOf(parent);
};

export const declaredBindingNameOf = (node: ESTree.Node): string | null => {
  const { parent } = node;
  if (parent === null || standsInTypePosition(parent)) return null;
  if (parent.type !== "VariableDeclarator") return declaredBindingNameOf(parent);
  if (parent.id.type !== "Identifier") return null;
  return parent.id === node ? null : parent.id.name;
};

export const standsForOwnValue = ({
  parent,
  held,
}: {
  readonly parent: ESTree.Node;
  readonly held: ESTree.Node;
}): boolean => {
  if (parent.type === "MemberExpression") return parent.computed || parent.property !== held;
  if (parent.type === "Property") return parent.computed || parent.key !== held;
  return true;
};

const headIdentifiesTest = (expression: ESTree.Expression): boolean => {
  if (expression.type === "Identifier") return TEST_IDENTIFYING_NAMES.has(expression.name);
  if (expression.type !== "MemberExpression") return false;

  const spelled = staticMemberName(expression);
  if (spelled !== null && TEST_IDENTIFYING_NAMES.has(spelled)) return true;
  return headIdentifiesTest(expression.object);
};

export const identifyingMemberNameOf = (node: ESTree.MemberExpression): string | null => {
  const spelled = staticMemberName(node);
  if (spelled === null || !TEST_IDENTIFYING_NAMES.has(spelled)) return null;
  return headIdentifiesTest(node.object) ? null : spelled;
};
