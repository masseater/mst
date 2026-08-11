import type { ESTree } from "@oxlint/plugins";

export type LooseTypeNode = ESTree.TSAnyKeyword | ESTree.TSUnknownKeyword;

const CONST_ASSERTION_NAME = "const";

export const looseTypeNodeOf = (node: ESTree.TSType): LooseTypeNode | null => {
  switch (node.type) {
    case "TSAnyKeyword":
    case "TSUnknownKeyword":
      return node;
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

const isConstAssertionType = (node: ESTree.TSType): boolean =>
  node.type === "TSTypeReference" &&
  node.typeName.type === "Identifier" &&
  node.typeName.name === CONST_ASSERTION_NAME;

export const isConcreteTypeClaim = (node: ESTree.TSType): boolean =>
  looseTypeNodeOf(node) === null && !isConstAssertionType(node);

export const isTypeAssertion = (node: ESTree.Expression): boolean =>
  node.type === "TSAsExpression" || node.type === "TSTypeAssertion";

export const unwrappedValueOf = (node: ESTree.Expression): ESTree.Expression => {
  switch (node.type) {
    case "ChainExpression":
    case "ParenthesizedExpression":
    case "TSNonNullExpression":
      return unwrappedValueOf(node.expression);
    default:
      return node;
  }
};

export const declaredReturnTypeOf = (node: ESTree.Node): ESTree.TSTypeAnnotation | null => {
  if (!("returnType" in node)) return null;
  return node.returnType ?? null;
};
