import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export const handedValues = (
  handed: readonly (ESTree.Expression | ESTree.SpreadElement | null)[],
): readonly ESTree.Expression[] =>
  handed.flatMap((held) => {
    if (held === null) return [];
    return held.type === "SpreadElement" ? [held.argument] : [held];
  });

const receiverOf = (call: ESTree.CallExpression): readonly ESTree.Expression[] => {
  const callee = unwrapSubject(call.callee);
  return callee.type === "MemberExpression" ? [callee.object] : [];
};

const objectPartsOf = (property: ESTree.ObjectPropertyKind): readonly ESTree.Expression[] =>
  property.type === "SpreadElement" ? [property.argument] : [property.value];

const valuePartsOf = (
  node: ESTree.Expression | ESTree.PrivateIdentifier,
): readonly ESTree.Expression[] => (node.type === "PrivateIdentifier" ? [] : [node]);

const producedPartsOf = (node: ESTree.Expression): readonly ESTree.Expression[] | null => {
  switch (node.type) {
    case "CallExpression":
      return [...receiverOf(node), ...handedValues(node.arguments)];
    case "NewExpression":
      return handedValues(node.arguments);
    case "MemberExpression":
      return [node.object];
    case "TaggedTemplateExpression":
      return [node.tag, ...node.quasi.expressions];
    case "TemplateLiteral":
      return node.expressions;
    case "ArrayExpression":
      return handedValues(node.elements);
    case "ObjectExpression":
      return node.properties.flatMap(objectPartsOf);
    case "ParenthesizedExpression":
      return [node.expression];
    default:
      return null;
  }
};

const carriedPartsOf = (node: ESTree.Expression): readonly ESTree.Expression[] => {
  switch (node.type) {
    case "ConditionalExpression":
      return [node.test, node.consequent, node.alternate];
    case "BinaryExpression":
      return [...valuePartsOf(node.left), node.right];
    case "LogicalExpression":
      return [node.left, node.right];
    case "SequenceExpression":
      return node.expressions;
    case "UnaryExpression":
      return [node.argument];
    case "AssignmentExpression":
      return [node.right];
    default:
      return [];
  }
};

export const partsOf = (node: ESTree.Expression): readonly ESTree.Expression[] =>
  producedPartsOf(node) ?? carriedPartsOf(node);
