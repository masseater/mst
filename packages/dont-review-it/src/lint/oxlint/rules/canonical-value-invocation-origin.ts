import {
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

const appendProperty = (origin: CanonicalValueOrigin, property: string): CanonicalValueOrigin =>
  origin.kind === "absent"
    ? origin
    : canonicalValueExpressionOrigin(origin.expression, [
        ...origin.projections,
        { kind: "property", path: [property] },
      ]);

const resolveMemberOrigins = (
  propertyState: CanonicalValuePropertyState,
  expression: ESTree.MemberExpression,
): CandidateSet<CanonicalValueOrigin> => {
  if (expression.object.type === "Super") return unknownCandidateSet();
  const keys = propertyState.propertyKeys({
    computed: expression.computed,
    key: expression.property,
  });
  return flatMapCandidateSet(keys, {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (property) => {
      const origins = resolveCanonicalValueInvocationOrigins(propertyState, expression.object);
      return {
        candidates: origins.candidates.map((origin) => appendProperty(origin, property)),
        complete: origins.complete,
      };
    },
  });
};

export const resolveCanonicalValueInvocationOrigins = (
  propertyState: CanonicalValuePropertyState,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueOrigin> => {
  const resolved = propertyState.origins({ expression });
  if (resolved.candidates.length !== 0 || expression.type !== "MemberExpression") return resolved;
  return resolveMemberOrigins(propertyState, expression);
};
