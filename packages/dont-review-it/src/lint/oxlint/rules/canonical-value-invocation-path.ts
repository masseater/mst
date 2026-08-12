import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

export const canonicalValueInvocationPropertyPath = (
  origin: CanonicalValueExpressionOrigin,
): readonly string[] | null => {
  if (!origin.projections.every((projection) => projection.kind === "property")) return null;
  const path = origin.projections.flatMap((projection) => projection.path);
  return path.every((segment): segment is string => typeof segment === "string") ? path : null;
};
