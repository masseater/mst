import * as ts from "typescript-6";

const typeNodeIsReadonlyObject = (node: ts.TypeNode): boolean => {
  if (ts.isParenthesizedTypeNode(node)) return typeNodeIsReadonlyObject(node.type);
  if (!ts.isTypeLiteralNode(node) || node.members.length === 0) return false;
  return node.members.every(
    (member) =>
      ts.isPropertySignature(member) &&
      (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Readonly) !== 0,
  );
};

const declarationIsReadonly = (declaration: ts.Declaration): boolean =>
  (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0;

const propertiesAreReadonly = (checker: ts.TypeChecker, type: ts.Type): boolean => {
  const properties = checker.getPropertiesOfType(type);
  return (
    properties.length > 0 &&
    properties.every((property) => property.declarations?.some(declarationIsReadonly) === true)
  );
};

export const canonicalOwnerBindingTypeIsReadonly = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
}): boolean => {
  const bindingType = input.checker.getTypeAtLocation(input.declaration.name);
  if (bindingType.isUnion()) return false;
  if (input.checker.isTupleType(bindingType)) {
    return (bindingType as ts.TupleTypeReference).target.readonly;
  }
  const typeNode = input.checker.typeToTypeNode(
    bindingType,
    input.declaration,
    ts.NodeBuilderFlags.InTypeAlias | ts.NodeBuilderFlags.NoTruncation,
  );
  return (
    (typeNode !== undefined && typeNodeIsReadonlyObject(typeNode)) ||
    propertiesAreReadonly(input.checker, bindingType)
  );
};
