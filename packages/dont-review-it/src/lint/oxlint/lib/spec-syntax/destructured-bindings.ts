import type { ESTree } from "@oxlint/plugins";

export type DestructuredBinding = {
  readonly name: ESTree.BindingIdentifier;
  readonly depth: number;
};

const bindingsUnder = (
  pattern: ESTree.BindingPattern | ESTree.ParamPattern,
  depth: number,
): readonly DestructuredBinding[] => {
  if (pattern.type === "Identifier") return [{ name: pattern, depth }];
  if (pattern.type === "AssignmentPattern") return bindingsUnder(pattern.left, depth);
  if (pattern.type === "RestElement") return bindingsUnder(pattern.argument, depth);
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.flatMap((property) =>
      property.type === "RestElement"
        ? bindingsUnder(property, depth)
        : bindingsUnder(property.value, depth + 1),
    );
  }
  if (pattern.type === "ArrayPattern") {
    return pattern.elements.flatMap((held) =>
      held === null ? [] : bindingsUnder(held, held.type === "RestElement" ? depth : depth + 1),
    );
  }
  return [];
};

export const destructuredBindingsOf = (
  pattern: ESTree.BindingPattern | ESTree.ParamPattern,
): readonly DestructuredBinding[] => bindingsUnder(pattern, 0);
