import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueInvocationArgumentSegment,
  CanonicalValueInvocationFact,
} from "./canonical-value-invocation-types.ts";

export const canonicalValueDirectInvocationSegments = (
  items: readonly ESTree.Argument[],
): readonly CanonicalValueInvocationArgumentSegment[] =>
  items.length === 0 ? [] : [{ elements: items, kind: "direct" }];

export const appendCanonicalValueInvocationSegments = (
  first: readonly CanonicalValueInvocationArgumentSegment[],
  second: readonly CanonicalValueInvocationArgumentSegment[],
): readonly CanonicalValueInvocationArgumentSegment[] => {
  const firstLast = first.at(-1);
  const secondFirst = second[0];
  if (firstLast?.kind !== "direct" || secondFirst?.kind !== "direct") {
    return [...first, ...second];
  }
  const merged = {
    elements: [...firstLast.elements, ...secondFirst.elements],
    kind: "direct",
  } as const;
  return [...first.slice(0, -1), merged, ...second.slice(1)];
};

export const canonicalValueDirectInvocationArguments = (
  segments: readonly CanonicalValueInvocationArgumentSegment[],
): readonly ESTree.Argument[] | null =>
  segments.every((segment) => segment.kind === "direct")
    ? segments.flatMap((segment) => segment.elements)
    : null;

export const canonicalValueLogicalInvocationArguments = (
  fact: CanonicalValueInvocationFact,
): readonly ESTree.Argument[] | null => {
  const direct = canonicalValueDirectInvocationArguments(fact.argumentSegments);
  if (direct !== null) return direct;
  const [segment] = fact.argumentSegments;
  if (segment?.kind !== "array" || fact.argumentSegments.length !== 1) return null;
  const expression = unwrapExpression(segment.expression);
  return expression.type === "ArrayExpression" &&
    expression.elements.every((element) => element !== null)
    ? expression.elements
    : null;
};
