import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";

import type { Definition, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";

const MODULE_VALUE_IMPORTED_NAME = "<module>";
export const CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME = "<namespace>";

export type CanonicalValueModuleImport = {
  readonly importedName: string;
  readonly specifier: string;
};

export const canonicalValueModuleImportFromDefinition = (
  definition: Definition,
): CanonicalValueModuleImport | null => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  const node = definition.node;
  if (node.type === "ImportNamespaceSpecifier" && declaration !== null) {
    return {
      importedName: CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME,
      specifier: declaration.source.value,
    };
  }
  return node.type === "TSImportEqualsDeclaration" &&
    node.moduleReference.type === "TSExternalModuleReference"
    ? {
        importedName: MODULE_VALUE_IMPORTED_NAME,
        specifier: node.moduleReference.expression.value,
      }
    : null;
};

const requiredModuleSpecifier = (
  expression: ESTree.Expression,
  bindingIndex: CanonicalValueBindingIndex,
): string | null => {
  if (expression.type !== "CallExpression" || expression.callee.type !== "Identifier") return null;
  if (expression.callee.name !== "require") return null;
  if (bindingIndex.resolveIdentifier(expression.callee) !== null) return null;
  const [argument] = expression.arguments;
  return argument?.type === "Literal" && typeof argument.value === "string" ? argument.value : null;
};

export const canonicalValueModuleImportFromExpression = (
  expression: ESTree.Expression,
  bindingIndex: CanonicalValueBindingIndex,
): CanonicalValueModuleImport | null => {
  if (expression.type === "AwaitExpression") {
    return canonicalValueModuleImportFromExpression(expression.argument, bindingIndex);
  }
  if (expression.type === "ImportExpression") {
    return expression.source.type === "Literal" && typeof expression.source.value === "string"
      ? {
          importedName: CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME,
          specifier: expression.source.value,
        }
      : null;
  }
  const specifier = requiredModuleSpecifier(expression, bindingIndex);
  return specifier === null ? null : { importedName: MODULE_VALUE_IMPORTED_NAME, specifier };
};
