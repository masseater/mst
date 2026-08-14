import { zip } from "es-toolkit";

import { staticPropertyName } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export type ComparedSide = ESTree.Expression | null;

export type ComparedPair = {
  readonly left: ComparedSide;
  readonly right: ComparedSide;
};

export type SideResolution = (node: ESTree.Expression) => ESTree.Expression;

export type Comparison = {
  readonly left: ComparedSide;
  readonly right: ComparedSide;
  readonly resolve: SideResolution;
};

type ContainerPositions<Written> = {
  readonly node: Written;
  readonly other: ComparedSide;
  readonly resolve: SideResolution;
};

const SETTLED_SHAPES: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "FunctionExpression",
  "Literal",
  "NewExpression",
  "ObjectExpression",
  "TemplateLiteral",
]);

export const isSettledShape = (node: ESTree.Expression): boolean =>
  SETTLED_SHAPES.has(unwrapSubject(node).type);

const convertedKeyOf = (property: ESTree.ObjectProperty): string | null => {
  const spelled = staticPropertyName(property);
  if (spelled !== null) return spelled;

  const { key } = property;
  return key.type === "Literal" && typeof key.value === "number" ? String(key.value) : null;
};

const memberOf = (
  property: ESTree.ObjectExpression["properties"][number],
): readonly [string, ESTree.Expression] | null => {
  if (property.type !== "Property") return null;

  const memberKey = convertedKeyOf(property);
  return memberKey === null ? null : [memberKey, property.value];
};

const membersOf = (
  node: ESTree.ObjectExpression,
): ReadonlyMap<string, ESTree.Expression> | null => {
  const written = node.properties.map((property) => memberOf(property));
  const settled = written.flatMap((member) => (member === null ? [] : [member]));
  return settled.length === written.length ? new Map(settled) : null;
};

const elementsOf = (node: ESTree.ArrayExpression): readonly ComparedSide[] | null => {
  const written = node.elements.map((held) => (held?.type === "SpreadElement" ? undefined : held));
  const settled = written.flatMap((held) => (held === undefined ? [] : [held]));
  return settled.length === written.length ? settled : null;
};

const pairedSides = (input: {
  readonly left: ESTree.Expression;
  readonly right: ComparedSide;
  readonly resolve: SideResolution;
}): readonly ComparedPair[] => {
  const { left, right, resolve } = input;
  return comparedPositionsOf({
    left: resolve(left),
    right: right === null ? null : resolve(right),
    resolve,
  });
};

const objectAgainstObject = (input: {
  readonly members: ReadonlyMap<string, ESTree.Expression>;
  readonly other: ESTree.ObjectExpression;
  readonly resolve: SideResolution;
}): readonly ComparedPair[] => {
  const { members, other, resolve } = input;
  const counterparts = membersOf(other);
  if (counterparts === null || counterparts.size !== members.size) return [];

  const lined = [...members].map(([memberKey, held]) => ({
    left: held,
    right: counterparts.get(memberKey) ?? null,
  }));
  if (lined.some((pair) => pair.right === null)) return [];
  return lined.flatMap((pair) => pairedSides({ ...pair, resolve }));
};

const objectPositions = (
  input: ContainerPositions<ESTree.ObjectExpression>,
): readonly ComparedPair[] => {
  const { node, other, resolve } = input;
  const members = membersOf(node);
  if (members === null) return [];
  if (other?.type === "ObjectExpression") return objectAgainstObject({ members, other, resolve });
  if (other !== null && isSettledShape(other)) return [];
  return [...members.values()].flatMap((held) => pairedSides({ left: held, right: null, resolve }));
};

const arrayAgainstArray = (input: {
  readonly elements: readonly ComparedSide[];
  readonly other: ESTree.ArrayExpression;
  readonly resolve: SideResolution;
}): readonly ComparedPair[] => {
  const { elements, other, resolve } = input;
  const counterparts = elementsOf(other);
  if (counterparts === null || counterparts.length !== elements.length) return [];

  const lined = zip(elements, counterparts);
  if (lined.some(([held, counterpart]) => (held === null) !== (counterpart === null))) {
    return [];
  }
  return lined.flatMap(([held, counterpart]) =>
    held === null ? [] : pairedSides({ left: held, right: counterpart, resolve }),
  );
};

const arrayPositions = (
  input: ContainerPositions<ESTree.ArrayExpression>,
): readonly ComparedPair[] => {
  const { node, other, resolve } = input;
  const listed = elementsOf(node);
  if (listed === null) return [];
  if (other?.type === "ArrayExpression")
    return arrayAgainstArray({ elements: listed, other, resolve });
  if (other !== null && isSettledShape(other)) return [];
  return listed.flatMap((held) =>
    held === null ? [] : pairedSides({ left: held, right: null, resolve }),
  );
};

export const comparedPositionsOf = (comparison: Comparison): readonly ComparedPair[] => {
  const { left, right, resolve } = comparison;
  if (left?.type === "ObjectExpression") {
    return objectPositions({ node: left, other: right, resolve });
  }
  if (right?.type === "ObjectExpression") {
    return objectPositions({ node: right, other: left, resolve });
  }
  if (left?.type === "ArrayExpression")
    return arrayPositions({ node: left, other: right, resolve });
  if (right?.type === "ArrayExpression") {
    return arrayPositions({ node: right, other: left, resolve });
  }
  return [{ left, right }];
};
