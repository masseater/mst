import { objectValueOf } from "../object-literal.ts";

import type { ESTree } from "@oxlint/plugins";

const textElementsIn = (held: ESTree.Expression | null): readonly string[] =>
  held?.type === "ArrayExpression"
    ? held.elements.flatMap((spelled) =>
        spelled?.type === "Literal" && typeof spelled.value === "string" ? [spelled.value] : [],
      )
    : [];

export const declaredPluginNamesIn = (holder: ESTree.ObjectExpression): readonly string[] =>
  textElementsIn(objectValueOf({ object: holder, key: "plugins" }));

export const declaredJsPluginNamesIn = (holder: ESTree.ObjectExpression): readonly string[] => {
  const held = objectValueOf({ object: holder, key: "jsPlugins" });
  if (held?.type !== "ArrayExpression") return [];

  return held.elements.flatMap((declared) => {
    if (declared?.type !== "ObjectExpression") return [];
    const named = objectValueOf({ object: declared, key: "name" });
    return named?.type === "Literal" && typeof named.value === "string" ? [named.value] : [];
  });
};
