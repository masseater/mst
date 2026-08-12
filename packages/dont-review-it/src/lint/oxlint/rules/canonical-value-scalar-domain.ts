import {
  closedCandidateSet,
  flatMapCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { type CanonicalValueExecutionContext } from "./canonical-value-binding-index.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueProjectionsSelectScalar,
  resolveCanonicalValueImportedRouteDomain,
} from "./canonical-value-route-domain.ts";
import {
  resolveCanonicalValueRouteOrigins,
  type CanonicalValueRouteOrigin,
} from "./canonical-value-route-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueDomainEnvironment } from "./canonical-value-domain.ts";

export type CanonicalValueScalarContext = {
  readonly cutoff?: number;
  readonly executionContext?: CanonicalValueExecutionContext;
};

export type CanonicalValueScalarDomainQuery = CanonicalValueScalarContext &
  (
    | { readonly expression: ESTree.Expression; readonly origin?: never }
    | { readonly expression?: never; readonly origin: CanonicalValueOrigin }
  );

const localScalarDomain = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueScalarContext & {
    readonly node: ESTree.Expression;
    readonly origin: CanonicalValueOrigin;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (query.origin.kind === "absent" || query.origin.projections.length !== 0) {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(
    environment.propertyState.primitives({
      cutoff: query.cutoff,
      executionContext: query.executionContext,
      expression: query.origin.expression,
    }),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (primitive) => {
        if (primitive === undefined || typeof primitive === "bigint") {
          return unknownCandidateSet();
        }
        return closedCandidateSet(
          [
            {
              derivedFromRegisteredRoute: false,
              kind: "values",
              localContribution: true,
              node: query.node,
              values: [primitive],
            },
          ],
          canonicalValueDomainFactIdentity,
        );
      },
    },
  );
};

const scalarRouteDomain = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueScalarContext & {
    readonly node: ESTree.Expression;
    readonly route: CanonicalValueRouteOrigin;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (query.route.kind === "unregistered") {
    return closedCandidateSet([query.route], canonicalValueDomainFactIdentity);
  }
  if (query.route.kind !== "local") {
    return canonicalValueProjectionsSelectScalar(query.route.valueProjections)
      ? resolveCanonicalValueImportedRouteDomain(query.route)
      : unknownCandidateSet();
  }
  return localScalarDomain(environment, { ...query, origin: query.route.origin });
};

export const resolveCanonicalValueScalarDomain = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueScalarDomainQuery,
): CandidateSet<CanonicalValueDomainFact> => {
  const origins =
    query.origin === undefined
      ? environment.propertyState.origins({
          cutoff: query.cutoff,
          executionContext: query.executionContext,
          expression: query.expression,
        })
      : closedCandidateSet([query.origin], canonicalValueOriginKey);
  const node = query.origin?.kind === "expression" ? query.origin.expression : query.expression;
  if (node === undefined) return unknownCandidateSet();
  return flatMapCandidateSet(resolveCanonicalValueRouteOrigins({ ...environment, origins }), {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (route) => scalarRouteDomain(environment, { ...query, node, route }),
  });
};
