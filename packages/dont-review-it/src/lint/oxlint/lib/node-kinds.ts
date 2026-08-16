import type { ESTree } from "@oxlint/plugins";

export const ARRAY_EXPRESSION = "ArrayExpression";

export const FUNCTION_NODE_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

export const isFunctionNodeType = (nodeType: string): boolean => FUNCTION_NODE_TYPES.has(nodeType);

export type TransparentWrapperNode =
  | ESTree.ChainExpression
  | ESTree.ParenthesizedExpression
  | ESTree.TSNonNullExpression;

const TRANSPARENT_WRAPPER_NODE_TYPES: ReadonlySet<string> = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSNonNullExpression",
]);

export const isTransparentWrapper = (node: ESTree.Node): node is TransparentWrapperNode =>
  TRANSPARENT_WRAPPER_NODE_TYPES.has(node.type);

export type TypeAssertingNode =
  | ESTree.TSAsExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.TSTypeAssertion;

const TYPE_ASSERTING_NODE_TYPES: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

export const isTypeAsserting = (node: ESTree.Node): node is TypeAssertingNode =>
  TYPE_ASSERTING_NODE_TYPES.has(node.type);

export type SugaredNode = TransparentWrapperNode | TypeAssertingNode;

export const SUGARED_NODE_TYPES: ReadonlySet<string> = new Set([
  ...TRANSPARENT_WRAPPER_NODE_TYPES,
  ...TYPE_ASSERTING_NODE_TYPES,
]);

export const isSugared = (node: ESTree.Node): node is SugaredNode =>
  SUGARED_NODE_TYPES.has(node.type);

export const IMPORT_BINDING_NODE_TYPES: ReadonlySet<string> = new Set([
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
  "ImportSpecifier",
]);
