import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueExecutionNode,
  CanonicalValueGuard,
} from "./canonical-value-binding-types.ts";

const ifGuard = (child: ESTree.Node, parent: ESTree.Node): CanonicalValueGuard | null => {
  if (parent.type === "IfStatement" && child === parent.consequent) {
    return { kind: "condition", outcome: "truthy", test: parent.test };
  }
  if (parent.type === "IfStatement" && child === parent.alternate) {
    return { kind: "condition", outcome: "falsy", test: parent.test };
  }
  return null;
};

const expressionGuard = (child: ESTree.Node, parent: ESTree.Node): CanonicalValueGuard | null => {
  if (parent.type === "ConditionalExpression") {
    return {
      kind: "condition",
      outcome: child === parent.consequent ? "truthy" : "falsy",
      test: parent.test,
    };
  }
  if (parent.type !== "LogicalExpression" || child !== parent.right) return null;
  return {
    kind: "condition",
    outcome: parent.operator === "&&" ? "truthy" : parent.operator === "||" ? "falsy" : "nullish",
    test: parent.left,
  };
};

const forStatementGuard = (
  child: ESTree.Node,
  parent: ESTree.ForStatement,
): CanonicalValueGuard | null => {
  if ((child === parent.body || child === parent.update) && parent.test !== null) {
    return { kind: "condition", outcome: "truthy", test: parent.test };
  }
  return null;
};

const loopGuard = (child: ESTree.Node, parent: ESTree.Node): CanonicalValueGuard | null => {
  if (parent.type === "WhileStatement" && child === parent.body) {
    return { kind: "condition", outcome: "truthy", test: parent.test };
  }
  if (parent.type === "ForStatement") return forStatementGuard(child, parent);
  if (
    (parent.type === "ForInStatement" || parent.type === "ForOfStatement") &&
    child === parent.body
  ) {
    return {
      kind: "iteration",
      operator: parent.type === "ForInStatement" ? "in" : "of",
      source: parent.right,
    };
  }
  return null;
};

const optionalGuard = (child: ESTree.Node, parent: ESTree.Node): CanonicalValueGuard | null => {
  if (
    parent.type === "MemberExpression" &&
    parent.optional &&
    parent.computed &&
    child === parent.property &&
    parent.object.type !== "Super"
  ) {
    return { kind: "condition", outcome: "non-nullish", test: parent.object };
  }
  if (
    parent.type !== "CallExpression" ||
    !parent.optional ||
    !parent.arguments.some((argument) => argument === child)
  ) {
    return null;
  }
  return parent.callee.type === "Super"
    ? null
    : { kind: "condition", outcome: "non-nullish", test: parent.callee };
};

const otherGuard = (parent: ESTree.Node): CanonicalValueGuard | null => {
  if (parent.type === "SwitchCase" && parent.parent.type === "SwitchStatement") {
    return {
      discriminant: parent.parent.discriminant,
      kind: "switch-case",
      node: parent,
      test: parent.test,
    };
  }
  return parent.type === "CatchClause" ? { kind: "catch", node: parent } : null;
};

const guardForEdge = (child: ESTree.Node, parent: ESTree.Node): CanonicalValueGuard | null =>
  ifGuard(child, parent) ??
  expressionGuard(child, parent) ??
  loopGuard(child, parent) ??
  optionalGuard(child, parent) ??
  otherGuard(parent);

export const canonicalValueGuardsBetween = (
  child: ESTree.Node,
  boundary: CanonicalValueExecutionNode,
): readonly CanonicalValueGuard[] => {
  const parent = child.parent;
  if (parent === null || parent === boundary) return [];
  const guard = guardForEdge(child, parent);
  return [...canonicalValueGuardsBetween(parent, boundary), ...(guard === null ? [] : [guard])];
};
