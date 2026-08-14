import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "./fingerprint.ts";

export type LiteralNode =
  | ESTree.BigIntLiteral
  | ESTree.BooleanLiteral
  | ESTree.NullLiteral
  | ESTree.NumericLiteral
  | ESTree.RegExpLiteral
  | ESTree.StringLiteral;

export const literalValue = (node: LiteralNode): CanonicalValue | null => {
  const spelling = node.value;
  if (
    typeof spelling === "string" ||
    typeof spelling === "number" ||
    typeof spelling === "boolean"
  ) {
    return spelling;
  }
  return null;
};

export const negatedNumericValue = (node: ESTree.UnaryExpression): CanonicalValue | null => {
  if (node.operator !== "-") return null;
  const { argument } = node;
  if (argument.type !== "Literal") return null;
  return typeof argument.value === "number" ? -argument.value : null;
};

export const templateLiteralValue = (node: ESTree.TemplateLiteral): CanonicalValue | null => {
  if (node.expressions.length !== 0) return null;
  return node.quasis
    .slice(0, 1)
    .map((quasi) => quasi.value.cooked)
    .join("");
};

const isValueMemberKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "AccessorProperty":
    case "MethodDefinition":
    case "Property":
    case "PropertyDefinition":
      return !parent.computed && parent.key === node;
    default:
      return null;
  }
};

const isTypeMemberKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "TSAbstractAccessorProperty":
    case "TSAbstractMethodDefinition":
    case "TSAbstractPropertyDefinition":
    case "TSMethodSignature":
    case "TSPropertySignature":
      return !parent.computed && parent.key === node;
    default:
      return null;
  }
};

export const isStructuralKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
  isValueMemberKeyPosition(parent, node) ??
  isTypeMemberKeyPosition(parent, node) ??
  (parent.type === "TSEnumMember" && parent.id === node);

const isModuleSourcePosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "ExportNamedDeclaration":
    case "ImportDeclaration":
    case "ImportExpression":
    case "TSImportType":
      return parent.source === node;
    case "TSExternalModuleReference":
      return parent.expression === node;
    case "ExportAllDeclaration":
      return parent.source === node || parent.exported === node;
    default:
      return null;
  }
};

const isModuleNamePosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "ImportAttribute":
      return parent.key === node || parent.value === node;
    case "ImportSpecifier":
      return parent.imported === node;
    case "ExportSpecifier":
      return parent.local === node || parent.exported === node;
    case "TSModuleDeclaration":
      return parent.id === node;
    default:
      return null;
  }
};

export const isModuleSyntaxPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
  isModuleSourcePosition(parent, node) ?? isModuleNamePosition(parent, node) ?? false;

const KEY_SELECTION_TYPE_NAMES: ReadonlySet<string> = new Set(["Omit", "Pick"]);

const isKeySelectionTypeName = (typeName: string): boolean =>
  KEY_SELECTION_TYPE_NAMES.has(typeName);

export const isKeySelectorArgument = (ancestors: readonly ESTree.Node[]): boolean => {
  for (const [index, ancestor] of ancestors.entries()) {
    if (ancestor.type !== "TSTypeReference") continue;
    if (ancestor.typeName.type !== "Identifier") continue;
    if (!isKeySelectionTypeName(ancestor.typeName.name)) continue;
    const instantiation = ancestors[index + 1] as ESTree.TSTypeParameterInstantiation;
    if (instantiation.params[1] === ancestors[index + 2]) return true;
  }
  return false;
};
