import { propertyKeyOf, removeObjectPropertyFix } from "../lib/object-literal.ts";
import { unwrapTransparentExpression } from "../lib/transparent-expression.ts";

import type { ESTree, FixFn, SourceCode } from "@oxlint/plugins";

export const configRootProblemOf = (
  config: ESTree.ObjectExpression,
  sourceCode: SourceCode,
): {
  readonly node: ESTree.ObjectProperty;
  readonly messageId: "testRootMovesSourceUniverse";
  readonly fix?: FixFn;
} | null => {
  const roots = config.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property) === "root",
  );
  const root = roots.at(-1);
  if (root === undefined) return null;
  return roots.length === 1 && unwrapTransparentExpression(root.value).type === "Literal"
    ? {
        node: root,
        messageId: "testRootMovesSourceUniverse",
        fix: removeObjectPropertyFix({ property: root, sourceCode }),
      }
    : { node: root, messageId: "testRootMovesSourceUniverse" };
};
