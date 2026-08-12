import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { propertyPathKey, type PropertyPath } from "../lib/canonical-values/property-path.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

export type CanonicalValueOriginProjection =
  | {
      readonly arguments: readonly ESTree.Argument[];
      readonly kind: "array-transform";
      readonly method: "filter" | "reduce" | "reduce-right" | "slice" | "to-spliced" | "with";
    }
  | { readonly kind: "array-element" }
  | { readonly kind: "array-slice"; readonly startIndex: number }
  | {
      readonly kind: "call-arguments";
      readonly segments: readonly CanonicalValueCallArgumentSegment[];
      readonly startIndex: number;
    }
  | { readonly excludedKeys: readonly string[]; readonly kind: "object-rest" }
  | { readonly kind: "property"; readonly path: PropertyPath }
  | { readonly kind: "property-name" }
  | { readonly kind: "static-values"; readonly values: readonly CanonicalValue[] };

export type CanonicalValueExpressionOrigin = {
  readonly expression: ESTree.Expression;
  readonly kind: "expression";
  readonly projections: readonly CanonicalValueOriginProjection[];
};

export type CanonicalValueAbsentOrigin = { readonly kind: "absent" };

export type CanonicalValueOrigin = CanonicalValueAbsentOrigin | CanonicalValueExpressionOrigin;

export const CANONICAL_VALUE_ABSENT_ORIGIN: CanonicalValueAbsentOrigin = { kind: "absent" };

const canonicalValueCallArgumentSegmentKey = (
  segment: CanonicalValueCallArgumentSegment,
): string => {
  if (segment.kind === "array") {
    return `array:${segment.expression.start}:${segment.expression.end}`;
  }
  if (segment.kind === "unknown") return "unknown";
  if (segment.kind === "source") {
    return `source:${segment.expression.start}:${segment.expression.end}:${segment.sourcePath
      .map((source) => source.kind)
      .join("/")}`;
  }
  return `direct:${segment.elements.map((element) => `${element.start}:${element.end}`).join(",")}`;
};

const canonicalValueCallArgumentsProjectionKey = (
  projection: Extract<CanonicalValueOriginProjection, { readonly kind: "call-arguments" }>,
): string =>
  `call-arguments:${projection.startIndex}:${projection.segments
    .map(canonicalValueCallArgumentSegmentKey)
    .join("|")}`;

export const canonicalValueOriginProjectionKey = (
  projection: CanonicalValueOriginProjection,
): string => {
  if (projection.kind === "array-transform") {
    return `array-transform:${projection.method}:${projection.arguments
      .map((argument) => `${argument.start}:${argument.end}`)
      .join(",")}`;
  }
  if (projection.kind === "array-element") return "array-element";
  if (projection.kind === "property") return `property:${propertyPathKey(projection.path)}`;
  if (projection.kind === "static-values") {
    return `static-values:${fingerprintValues(projection.values)}`;
  }
  if (projection.kind === "array-slice") return `slice:${projection.startIndex}`;
  if (projection.kind === "call-arguments") {
    return canonicalValueCallArgumentsProjectionKey(projection);
  }
  return projection.kind === "property-name"
    ? "property-name"
    : `rest:${JSON.stringify(projection.excludedKeys)}`;
};

export const canonicalValueOriginKey = (origin: CanonicalValueOrigin): string =>
  origin.kind === "absent"
    ? "absent"
    : `${origin.expression.start}:${origin.expression.end}:${origin.projections.map(canonicalValueOriginProjectionKey).join("|")}`;

export const canonicalValueExpressionOrigin = (
  expression: ESTree.Expression,
  projections: readonly CanonicalValueOriginProjection[] = [],
): CanonicalValueExpressionOrigin => ({ expression, kind: "expression", projections });

export const appendCanonicalValueOriginProjection = (
  origin: CanonicalValueOrigin,
  projection: CanonicalValueOriginProjection,
): CanonicalValueOrigin =>
  origin.kind === "absent"
    ? origin
    : { ...origin, projections: [...origin.projections, projection] };

export const appendCanonicalValueOriginPath = (
  origin: CanonicalValueOrigin,
  path: PropertyPath,
): CanonicalValueOrigin =>
  path.length === 0
    ? origin
    : appendCanonicalValueOriginProjection(origin, { kind: "property", path });
