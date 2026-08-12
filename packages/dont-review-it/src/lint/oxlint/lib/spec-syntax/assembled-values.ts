import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const ABSENT_VALUE_NAME = "undefined";

const ABSENT_VALUE_OPERATOR = "void";

export const WRITTEN_OUT_SHAPE = "a value written out in the spec";

const ASSEMBLED_SHAPES: ReadonlyMap<string, string> = new Map([
  ["ArrayExpression", "an array literal"],
  ["NewExpression", "a value a constructor built here"],
  ["ObjectExpression", "an object literal"],
]);

const isWrittenOutValue = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "Literal") return true;
  if (written.type === "TemplateLiteral") return written.expressions.length === 0;
  if (written.type === "Identifier") return written.name === ABSENT_VALUE_NAME;
  if (written.type !== "UnaryExpression") return false;
  return written.operator === ABSENT_VALUE_OPERATOR || isWrittenOutValue(written.argument);
};

export const assembledShapeOf = (node: ESTree.Expression): string | null => {
  const written = unwrapSubject(node);
  if (isWrittenOutValue(written)) return WRITTEN_OUT_SHAPE;
  return ASSEMBLED_SHAPES.get(written.type) ?? null;
};

export const isEmptyContainer = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "ArrayExpression") return written.elements.length === 0;
  return written.type === "ObjectExpression" && written.properties.length === 0;
};
