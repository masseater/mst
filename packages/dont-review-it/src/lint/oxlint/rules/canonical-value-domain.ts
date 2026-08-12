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
  canonicalValueCollectionFragment,
  canonicalValueFragmentKey,
  type CanonicalValueFragment,
} from "./canonical-value-domain-fragment.ts";
import { resolveCanonicalValueLocalCollectionDomain } from "./canonical-value-local-collection-domain.ts";
import { resolveCanonicalValuePropertyNameDomain } from "./canonical-value-property-name-domain.ts";
import { type CanonicalValuePropertyNameOrigin } from "./canonical-value-property-name-origin.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { type CanonicalValuePropertyState } from "./canonical-value-property-state.ts";
import {
  canonicalValueProjectionsSelectScalar,
  resolveCanonicalValueImportedRouteDomain,
} from "./canonical-value-route-domain.ts";
import {
  classifyCanonicalValueImportedRoute,
  resolveCanonicalValueRouteOrigins,
  type CanonicalValueImportedRoute,
  type CanonicalValueImportedRouteClassifier,
  type CanonicalValueRouteOrigin,
} from "./canonical-value-route-origin.ts";
import {
  resolveCanonicalValueScalarDomain,
  type CanonicalValueScalarDomainQuery,
} from "./canonical-value-scalar-domain.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalog } from "../lib/canonical-values/catalog.ts";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";

export type CanonicalValueDomainEnvironment = {
  readonly bindingIndex: Parameters<typeof resolveCanonicalValueRouteOrigins>[0]["bindingIndex"];
  readonly catalog: CanonicalValuesCatalog;
  readonly classifyImportedRoute?: CanonicalValueImportedRouteClassifier;
  readonly filename: string;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
  readonly repositoryRoot: string;
};

type CanonicalValueDomainQuery = {
  readonly cutoff?: number;
  readonly executionContext?: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
};

type CanonicalValueDomainInternalQuery = CanonicalValueDomainQuery & {
  readonly seenExpressions: ReadonlySet<ESTree.Expression>;
};

export type { CanonicalValueDomainFact } from "./canonical-value-domain-fact.ts";

export type CanonicalValueDomainResolver = {
  readonly collection: (query: CanonicalValueDomainQuery) => CandidateSet<CanonicalValueDomainFact>;
  readonly origin: (query: {
    readonly cutoff?: number;
    readonly executionContext?: CanonicalValueExecutionContext;
    readonly origin: CanonicalValueOrigin;
  }) => CandidateSet<CanonicalValueDomainFact>;
  readonly imported: (route: CanonicalValueImportedRoute) => CandidateSet<CanonicalValueDomainFact>;
  readonly propertyNames: (
    origin: CanonicalValuePropertyNameOrigin,
  ) => CandidateSet<CanonicalValueDomainFact>;
  readonly route: (route: CanonicalValueRouteOrigin) => CandidateSet<CanonicalValueDomainFact>;
  readonly scalar: (
    query: CanonicalValueScalarDomainQuery,
  ) => CandidateSet<CanonicalValueDomainFact>;
};

const primitiveFragment = ({
  environment,
  query,
  expression,
}: {
  readonly environment: CanonicalValueDomainEnvironment;
  readonly query: CanonicalValueDomainInternalQuery;
  readonly expression: ESTree.Expression;
}): CandidateSet<CanonicalValueFragment> => {
  const primitives = environment.propertyState.primitives({
    cutoff: query.cutoff,
    executionContext: query.executionContext,
    expression,
  });
  return flatMapCandidateSet(primitives, {
    candidateKey: canonicalValueFragmentKey,
    mapCandidate: (primitive) => {
      if (primitive === undefined || typeof primitive === "bigint") {
        return unknownCandidateSet();
      }
      return closedCandidateSet(
        [
          {
            derivedFromRegisteredRoute: false,
            kind: "fragment",
            localContribution: true,
            values: [primitive],
          },
        ],
        canonicalValueFragmentKey,
      );
    },
  });
};

const scalarFragment = ({
  environment,
  origin,
  query,
}: {
  readonly environment: CanonicalValueDomainEnvironment;
  readonly origin: CanonicalValueOrigin;
  readonly query: CanonicalValueDomainInternalQuery;
}): CandidateSet<CanonicalValueFragment> =>
  origin.kind === "absent" || origin.projections.length !== 0
    ? unknownCandidateSet()
    : primitiveFragment({ environment, expression: origin.expression, query });

const scalarRouteFragment = ({
  environment,
  query,
  route,
}: {
  readonly environment: CanonicalValueDomainEnvironment;
  readonly query: CanonicalValueDomainInternalQuery;
  readonly route: CanonicalValueRouteOrigin;
}): CandidateSet<CanonicalValueFragment> => {
  if (route.kind === "unregistered") {
    return closedCandidateSet([route], canonicalValueFragmentKey);
  }
  if (route.kind !== "local") {
    return canonicalValueProjectionsSelectScalar(route.valueProjections)
      ? flatMapCandidateSet(resolveCanonicalValueImportedRouteDomain(route), {
          candidateKey: canonicalValueFragmentKey,
          mapCandidate: canonicalValueCollectionFragment,
        })
      : unknownCandidateSet();
  }
  if (route.origin.kind !== "absent" && route.origin.projections.length !== 0) {
    return flatMapCandidateSet(
      localCollectionOrigin({ environment, origin: route.origin, query }),
      {
        candidateKey: canonicalValueFragmentKey,
        mapCandidate: canonicalValueCollectionFragment,
      },
    );
  }
  return scalarFragment({ environment, origin: route.origin, query });
};

const scalarFragments = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueDomainInternalQuery,
): CandidateSet<CanonicalValueFragment> => {
  const staticExpression = primitiveFragment({
    environment,
    expression: query.expression,
    query,
  });
  if (staticExpression.complete && staticExpression.candidates.length !== 0) {
    return staticExpression;
  }
  return flatMapCandidateSet(
    resolveCanonicalValueRouteOrigins({
      ...environment,
      origins: environment.propertyState.origins(query),
    }),
    {
      candidateKey: canonicalValueFragmentKey,
      mapCandidate: (route) => scalarRouteFragment({ environment, query, route }),
    },
  );
};

const collectionFragments = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueDomainInternalQuery,
): CandidateSet<CanonicalValueFragment> =>
  flatMapCandidateSet(resolveCollection(environment, query), {
    candidateKey: canonicalValueFragmentKey,
    mapCandidate: canonicalValueCollectionFragment,
  });
const localCollectionOrigin = ({
  environment,
  origin,
  query,
}: {
  readonly environment: CanonicalValueDomainEnvironment;
  readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
  readonly query: CanonicalValueDomainInternalQuery;
}): CandidateSet<CanonicalValueDomainFact> =>
  resolveCanonicalValueLocalCollectionDomain({
    collectionFragments: (next) => collectionFragments(environment, next),
    environment,
    origin,
    query,
    scalarFragments: (next) => scalarFragments(environment, next),
  });

const importedDomain = (
  environment: CanonicalValueDomainEnvironment,
  route: CanonicalValueImportedRoute,
): CandidateSet<CanonicalValueDomainFact> => {
  const classify = environment.classifyImportedRoute ?? classifyCanonicalValueImportedRoute;
  return resolveCanonicalValueImportedRouteDomain(
    classify({
      bindingIndex: environment.bindingIndex,
      catalog: environment.catalog,
      filename: environment.filename,
      repositoryRoot: environment.repositoryRoot,
      route,
    }),
  );
};

const domainFactFromRoute = ({
  environment,
  query,
  route,
}: {
  readonly environment: CanonicalValueDomainEnvironment;
  readonly query: CanonicalValueDomainInternalQuery;
  readonly route: CanonicalValueRouteOrigin;
}): CandidateSet<CanonicalValueDomainFact> => {
  if (route.kind === "local") {
    return route.origin.kind === "absent"
      ? unknownCandidateSet()
      : localCollectionOrigin({ environment, origin: route.origin, query });
  }
  return resolveCanonicalValueImportedRouteDomain(route);
};

const resolveCollection = (
  environment: CanonicalValueDomainEnvironment,
  query: CanonicalValueDomainInternalQuery,
): CandidateSet<CanonicalValueDomainFact> =>
  flatMapCandidateSet(
    resolveCanonicalValueRouteOrigins({
      ...environment,
      origins: environment.propertyState.origins(query),
    }),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (route) => domainFactFromRoute({ environment, query, route }),
    },
  );

export const createCanonicalValueDomainResolver = (
  environment: CanonicalValueDomainEnvironment,
): CanonicalValueDomainResolver => {
  const origin = ({
    cutoff,
    executionContext,
    origin: candidate,
  }: Parameters<
    CanonicalValueDomainResolver["origin"]
  >[0]): CandidateSet<CanonicalValueDomainFact> => {
    if (candidate.kind === "absent") return unknownCandidateSet();
    const query = {
      cutoff,
      executionContext,
      expression: candidate.expression,
      seenExpressions: new Set<ESTree.Expression>(),
    };
    return flatMapCandidateSet(
      resolveCanonicalValueRouteOrigins({
        ...environment,
        origins: closedCandidateSet([candidate], canonicalValueOriginKey),
      }),
      {
        candidateKey: canonicalValueDomainFactIdentity,
        mapCandidate: (route) => domainFactFromRoute({ environment, query, route }),
      },
    );
  };
  return {
    collection: (query) => resolveCollection(environment, { ...query, seenExpressions: new Set() }),
    imported: (route) => importedDomain(environment, route),
    origin,
    propertyNames: (candidate) => resolveCanonicalValuePropertyNameDomain(environment, candidate),
    route: resolveCanonicalValueImportedRouteDomain,
    scalar: (query) => resolveCanonicalValueScalarDomain(environment, query),
  };
};
