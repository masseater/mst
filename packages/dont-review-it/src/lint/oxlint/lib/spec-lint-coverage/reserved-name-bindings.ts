import { unwrapSubject } from "../spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export const RESERVED_SPEC_NAMES: ReadonlySet<string> = new Set(["it", "test", "expect"]);

export const reservedIdentifierOf = (
  declared: ESTree.Node | null,
): ESTree.BindingIdentifier | null => {
  if (declared?.type !== "Identifier") return null;
  return RESERVED_SPEC_NAMES.has(declared.name) ? declared : null;
};

const FOREIGN_INITIALIZER_TYPES: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "FunctionExpression",
  "Literal",
  "ObjectExpression",
  "TemplateLiteral",
]);

export const carriesForeignMeaning = (initializer: ESTree.Expression | null): boolean =>
  initializer === null || FOREIGN_INITIALIZER_TYPES.has(unwrapSubject(initializer).type);
