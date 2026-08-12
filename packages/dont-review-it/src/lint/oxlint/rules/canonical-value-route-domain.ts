import {
  closedCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";
import { type CanonicalValueOriginProjection } from "./canonical-value-property-origin.ts";
import { type CanonicalValueRouteOrigin } from "./canonical-value-route-origin.ts";

import type { CanonicalValuesEntry } from "../lib/canonical-values/catalog.ts";

type RegisteredProjectionState = {
  readonly exact: boolean;
  readonly values: readonly CanonicalValue[];
};

export const canonicalValueProjectionsSelectScalar = (
  projections: readonly CanonicalValueOriginProjection[],
): boolean =>
  projections.some((projection) => {
    if (projection.kind === "array-element" || projection.kind === "property-name") return true;
    if (projection.kind !== "property" || projection.path.length !== 1) return false;
    const [property] = projection.path;
    return typeof property === "string" && canonicalValueArrayIndexOf(property) !== null;
  });

export const commonCanonicalValueRegisteredEntry = (
  entries: readonly CanonicalValuesEntry[],
): CanonicalValuesEntry | null => {
  const [first] = entries;
  if (first === undefined) return null;
  return entries.every((entry) => entry.fingerprint === first.fingerprint) ? first : null;
};

const projectRegisteredValues = (
  state: RegisteredProjectionState,
  projection: CanonicalValueOriginProjection,
): RegisteredProjectionState => {
  if (!state.exact) return state;
  if (projection.kind === "array-element" || projection.kind === "property-name") return state;
  if (projection.kind === "array-slice") {
    return { exact: true, values: state.values.slice(projection.startIndex) };
  }
  if (projection.kind === "object-rest") {
    return {
      exact: true,
      values: state.values.filter((value) => !projection.excludedKeys.includes(String(value))),
    };
  }
  if (projection.kind === "property") return projectRegisteredProperty(state, projection);
  return { exact: false, values: state.values };
};

const projectRegisteredProperty = (
  state: RegisteredProjectionState,
  projection: Extract<CanonicalValueOriginProjection, { readonly kind: "property" }>,
): RegisteredProjectionState => {
  const [property] = projection.path;
  const index =
    projection.path.length === 1 && typeof property === "string"
      ? canonicalValueArrayIndexOf(property)
      : null;
  return index === null
    ? { exact: false, values: state.values }
    : { exact: true, values: state.values.slice(index, index + 1) };
};

const projectedRegisteredDomain = (
  route: Extract<CanonicalValueRouteOrigin, { readonly kind: "registered" }>,
): CandidateSet<CanonicalValueDomainFact> => {
  const entry = commonCanonicalValueRegisteredEntry(route.entries);
  if (entry === null) return unknownCandidateSet();
  const projected = route.valueProjections.reduce<RegisteredProjectionState>(
    projectRegisteredValues,
    { exact: true, values: entry.values },
  );
  const changed = !projected.exact || fingerprintValues(projected.values) !== entry.fingerprint;
  if (!changed) return closedCandidateSet([route], canonicalValueDomainFactIdentity);
  return closedCandidateSet(
    [
      {
        derivedFromRegisteredRoute: true,
        kind: "values",
        localContribution: true,
        node: route.node,
        values: projected.values,
      },
    ],
    canonicalValueDomainFactIdentity,
  );
};

export const resolveCanonicalValueImportedRouteDomain = (
  route: CanonicalValueRouteOrigin,
): CandidateSet<CanonicalValueDomainFact> => {
  if (route.kind === "local") return unknownCandidateSet();
  if (route.kind === "registered" && route.valueProjections.length !== 0) {
    return projectedRegisteredDomain(route);
  }
  return closedCandidateSet([route], canonicalValueDomainFactIdentity);
};
