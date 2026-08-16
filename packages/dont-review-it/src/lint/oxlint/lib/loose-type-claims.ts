import { isTransparentWrapper } from "./node-kinds.ts";
import { isWidenedType, type WidenedTypeNode } from "./widened-type-nodes.ts";

import type { ESTree } from "@oxlint/plugins";

export const looseTypeNodeOf = (node: ESTree.TSType): WidenedTypeNode | null => {
  if (isWidenedType(node)) return node;

  switch (node.type) {
    case "TSParenthesizedType":
      return looseTypeNodeOf(node.typeAnnotation);
    case "TSUnionType": {
      const loose = node.types
        .map((member) => looseTypeNodeOf(member))
        .filter((member) => member !== null);
      return loose.find((member) => member.type === "TSAnyKeyword") ?? loose[0] ?? null;
    }
    default:
      return null;
  }
};

const CONST_ASSERTION_NAME = "const";

const isConstAssertionType = (node: ESTree.TSType): boolean =>
  node.type === "TSTypeReference" &&
  node.typeName.type === "Identifier" &&
  node.typeName.name === CONST_ASSERTION_NAME;

export const isConcreteTypeClaim = (node: ESTree.TSType): boolean =>
  looseTypeNodeOf(node) === null && !isConstAssertionType(node);

export const isTypeAssertion = (node: ESTree.Expression): boolean =>
  node.type === "TSAsExpression" || node.type === "TSTypeAssertion";

export const unwrappedValueOf = (node: ESTree.Expression): ESTree.Expression =>
  isTransparentWrapper(node) ? unwrappedValueOf(node.expression) : node;

export const declaredReturnTypeOf = (node: ESTree.Node): ESTree.TSTypeAnnotation | null => {
  if (!("returnType" in node)) return null;
  return node.returnType ?? null;
};
