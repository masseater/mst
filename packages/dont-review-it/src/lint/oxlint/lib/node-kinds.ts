export const ARRAY_EXPRESSION = "ArrayExpression";

export const FUNCTION_NODE_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

export const SUGARED_NODE_TYPES: ReadonlySet<string> = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

export const IMPORT_BINDING_NODE_TYPES: ReadonlySet<string> = new Set([
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
  "ImportSpecifier",
]);
