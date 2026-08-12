import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import {
  canonicalValueRouteOriginKey,
  type CanonicalValueRouteOrigin,
} from "./canonical-value-route-origin.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueDomainFact =
  | {
      readonly catalogBindingContribution?: boolean;
      readonly derivedFromRegisteredRoute: boolean;
      readonly kind: "values";
      readonly localContribution: boolean;
      readonly node: ESTree.Span;
      readonly values: readonly CanonicalValue[];
    }
  | Extract<
      CanonicalValueRouteOrigin,
      { readonly kind: "external" | "registered" | "unregistered" }
    >;

export const canonicalValueDomainFactIdentity = (fact: CanonicalValueDomainFact): string =>
  fact.kind === "values"
    ? `values:${fingerprintValues(fact.values)}:${String(fact.localContribution)}:${String(fact.derivedFromRegisteredRoute)}:${String(fact.catalogBindingContribution === true)}`
    : canonicalValueRouteOriginKey(fact);
