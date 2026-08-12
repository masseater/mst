import { propertyKeyName, unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { bindingInScope, type ScopeLookup } from "./scope-resolution.ts";

import type { ESTree } from "@oxlint/plugins";

const KEY_SELECTION_TYPE_NAMES: ReadonlySet<string> = new Set(["Omit", "Pick"]);
const IMPORT_ATTRIBUTE_OPTION_NAMES: ReadonlySet<string> = new Set(["assert", "with"]);

type CanonicalLiteralPosition = {
  readonly ancestors: readonly ESTree.Node[];
  readonly node: ESTree.Node;
  readonly scopeAt: ScopeLookup;
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

const isStructuralKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
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

const isModuleSyntaxPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
  isModuleSourcePosition(parent, node) ?? isModuleNamePosition(parent, node) ?? false;

const isObjectExpressionProperty = (node: ESTree.Node): node is ESTree.ObjectProperty =>
  node.type === "Property" && node.parent.type === "ObjectExpression";

const isDynamicImportOptions = ({
  ancestors,
  option,
}: {
  readonly ancestors: readonly ESTree.Node[];
  readonly option: ESTree.ObjectExpression;
}): boolean =>
  ancestors.some(
    (candidate) =>
      candidate.type === "ImportExpression" &&
      candidate.options !== null &&
      unwrapExpression(candidate.options) === option,
  );

const isDynamicImportAttributePosition = ({
  ancestors,
  node,
}: Omit<CanonicalLiteralPosition, "scopeAt">): boolean =>
  ancestors.some((attribute) => {
    if (!isObjectExpressionProperty(attribute)) return false;
    if (attribute.key !== node && unwrapExpression(attribute.value) !== node) return false;

    const attributeObject = attribute.parent;
    return ancestors.some((option) => {
      if (!isObjectExpressionProperty(option)) return false;
      if (!IMPORT_ATTRIBUTE_OPTION_NAMES.has(propertyKeyName(option.key) ?? "")) return false;
      if (unwrapExpression(option.value) !== attributeObject) return false;
      const optionObject = option.parent;
      if (optionObject.type !== "ObjectExpression") return false;
      return isDynamicImportOptions({ ancestors, option: optionObject });
    });
  });

const isDynamicImportSourcePosition = ({
  ancestors,
  node,
}: Omit<CanonicalLiteralPosition, "scopeAt">): boolean =>
  ancestors.some(
    (ancestor) =>
      ancestor.type === "ImportExpression" && unwrapExpression(ancestor.source) === node,
  );

const isStandardKeySelector = (node: ESTree.TSTypeReference, scopeAt: ScopeLookup): boolean =>
  node.typeName.type === "Identifier" &&
  KEY_SELECTION_TYPE_NAMES.has(node.typeName.name) &&
  bindingInScope(scopeAt(node.typeName), node.typeName.name) === null;

const isSelectedKey = ({
  ancestors,
  index,
  node,
}: {
  readonly ancestors: readonly ESTree.Node[];
  readonly index: number;
  readonly node: ESTree.Node;
}): boolean => {
  const instantiation = ancestors[index + 1];
  if (instantiation?.type !== "TSTypeParameterInstantiation") return false;
  return instantiation.params[1] === (ancestors[index + 2] ?? node);
};

const isKeySelectorArgument = ({ ancestors, node, scopeAt }: CanonicalLiteralPosition): boolean =>
  ancestors.some(
    (ancestor, index) =>
      ancestor.type === "TSTypeReference" &&
      isStandardKeySelector(ancestor, scopeAt) &&
      isSelectedKey({ ancestors, index, node }),
  );

const isExemptCanonicalLiteralPosition = (position: CanonicalLiteralPosition): boolean => {
  if (isDynamicImportAttributePosition(position)) return true;
  if (isDynamicImportSourcePosition(position)) return true;
  const parent = position.ancestors.at(-1);
  if (parent !== undefined && isStructuralKeyPosition(parent, position.node)) return true;
  if (parent !== undefined && isModuleSyntaxPosition(parent, position.node)) return true;
  return isKeySelectorArgument(position);
};

export { isExemptCanonicalLiteralPosition };
