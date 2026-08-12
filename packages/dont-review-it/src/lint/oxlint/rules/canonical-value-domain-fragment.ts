import {
  appendCandidateSets,
  closedCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import { commonCanonicalValueRegisteredEntry } from "./canonical-value-route-domain.ts";

export type CanonicalValueFragment =
  | {
      readonly catalogBindingContribution?: boolean;
      readonly derivedFromRegisteredRoute: boolean;
      readonly kind: "fragment";
      readonly localContribution: boolean;
      readonly values: readonly CanonicalValue[];
    }
  | Extract<CanonicalValueDomainFact, { readonly kind: "unregistered" }>;

export const canonicalValueFragmentKey = (fragment: CanonicalValueFragment): string =>
  fragment.kind === "unregistered"
    ? canonicalValueDomainFactIdentity(fragment)
    : `fragment:${fingerprintValues(fragment.values)}:${String(fragment.localContribution)}:${String(fragment.derivedFromRegisteredRoute)}:${String(fragment.catalogBindingContribution === true)}`;

const registeredFragment = (
  fact: Extract<CanonicalValueDomainFact, { readonly kind: "registered" }>,
): CandidateSet<CanonicalValueFragment> => {
  const entry = commonCanonicalValueRegisteredEntry(fact.entries);
  return entry === null
    ? unknownCandidateSet()
    : closedCandidateSet(
        [
          {
            derivedFromRegisteredRoute: true,
            kind: "fragment",
            localContribution: false,
            values: entry.values,
          },
        ],
        canonicalValueFragmentKey,
      );
};

export const canonicalValueCollectionFragment = (
  fact: CanonicalValueDomainFact,
): CandidateSet<CanonicalValueFragment> => {
  if (fact.kind === "unregistered") {
    return closedCandidateSet([fact], canonicalValueFragmentKey);
  }
  if (fact.kind === "registered") return registeredFragment(fact);
  if (fact.kind === "external") return unknownCandidateSet();
  return closedCandidateSet(
    [
      {
        catalogBindingContribution: fact.catalogBindingContribution,
        derivedFromRegisteredRoute: fact.derivedFromRegisteredRoute,
        kind: "fragment",
        localContribution: fact.localContribution,
        values: fact.values,
      },
    ],
    canonicalValueFragmentKey,
  );
};

const joinedFragment = (
  left: CanonicalValueFragment,
  right: CanonicalValueFragment,
): CanonicalValueFragment => {
  if (left.kind === "unregistered") return left;
  if (right.kind === "unregistered") return right;
  return {
    catalogBindingContribution:
      left.catalogBindingContribution === true || right.catalogBindingContribution === true,
    derivedFromRegisteredRoute: left.derivedFromRegisteredRoute || right.derivedFromRegisteredRoute,
    kind: "fragment",
    localContribution: left.localContribution || right.localContribution,
    values: [...left.values, ...right.values],
  };
};

export const appendCanonicalValueFragments = (
  accumulated: CandidateSet<CanonicalValueFragment>,
  next: CandidateSet<CanonicalValueFragment>,
): CandidateSet<CanonicalValueFragment> =>
  appendCandidateSets({
    accumulated,
    append: joinedFragment,
    candidateKey: canonicalValueFragmentKey,
    next,
  });

export const emptyCanonicalValueFragmentSet = (): CandidateSet<CanonicalValueFragment> =>
  closedCandidateSet(
    [
      {
        derivedFromRegisteredRoute: false,
        kind: "fragment",
        localContribution: false,
        values: [],
      },
    ],
    canonicalValueFragmentKey,
  );
