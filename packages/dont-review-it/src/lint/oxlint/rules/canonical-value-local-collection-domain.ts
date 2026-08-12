import {
  closedCandidateSet,
  flatMapCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { resolveCanonicalValueArrayResultTransform } from "./canonical-value-array-result-transform.ts";
import { canonicalValueYieldCallArgumentSegments } from "./canonical-value-binding-call-segments.ts";
import { resolveCanonicalValueCallArgumentDomain } from "./canonical-value-call-argument-domain.ts";
import { type CanonicalValueCollectionQuery } from "./canonical-value-collection-query.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import {
  appendCanonicalValueFragments,
  canonicalValueFragmentKey,
  emptyCanonicalValueFragmentSet,
  type CanonicalValueFragment,
} from "./canonical-value-domain-fragment.ts";
import { resolveCanonicalValueObjectKeysDomain } from "./canonical-value-object-keys-domain.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";
import { resolveCanonicalValuePropertyNameOriginsDomain } from "./canonical-value-property-name-domain.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";

type LocalCollectionEnvironment = Parameters<typeof resolveCanonicalValueObjectKeysDomain>[0];

type LocalCollectionResolution = {
  readonly collectionFragments: (
    query: CanonicalValueCollectionQuery,
  ) => CandidateSet<CanonicalValueFragment>;
  readonly environment: LocalCollectionEnvironment;
  readonly scalarFragments: (
    query: CanonicalValueCollectionQuery,
  ) => CandidateSet<CanonicalValueFragment>;
};

const domainFromFragments = (
  node: ESTree.Expression,
  fragments: CandidateSet<CanonicalValueFragment>,
): CandidateSet<CanonicalValueDomainFact> =>
  flatMapCandidateSet(fragments, {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (fragment) =>
      fragment.kind === "unregistered"
        ? closedCandidateSet([fragment], canonicalValueDomainFactIdentity)
        : closedCandidateSet(
            [
              {
                catalogBindingContribution: fragment.catalogBindingContribution,
                derivedFromRegisteredRoute: fragment.derivedFromRegisteredRoute,
                kind: "values",
                localContribution: fragment.localContribution,
                node,
                values: fragment.values,
              },
            ],
            canonicalValueDomainFactIdentity,
          ),
  });

const arrayElementFragments = (
  resolution: LocalCollectionResolution,
  input: {
    readonly element: ESTree.ArrayExpression["elements"][number];
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueFragment> => {
  if (input.element === null) return unknownCandidateSet();
  const expression =
    input.element.type === "SpreadElement" ? input.element.argument : input.element;
  const next = { ...input.query, expression };
  return input.element.type === "SpreadElement"
    ? resolution.collectionFragments(next)
    : resolution.scalarFragments(next);
};

const directArray = (
  resolution: LocalCollectionResolution,
  query: CanonicalValueCollectionQuery & { readonly expression: ESTree.ArrayExpression },
): CandidateSet<CanonicalValueDomainFact> => {
  const fragments = query.expression.elements.reduce<CandidateSet<CanonicalValueFragment>>(
    (accumulated, element) =>
      appendCanonicalValueFragments(
        accumulated,
        arrayElementFragments(resolution, { element, query }),
      ),
    emptyCanonicalValueFragmentSet(),
  );
  return domainFromFragments(query.expression, fragments);
};

const callArgumentsDomain = (
  resolution: LocalCollectionResolution,
  input: {
    readonly expression: ESTree.Expression;
    readonly projection: Extract<
      CanonicalValueOriginProjection,
      { readonly kind: "call-arguments" }
    >;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> =>
  resolveCanonicalValueCallArgumentDomain(
    {
      append: appendCanonicalValueFragments,
      collection: (query, expression) => resolution.collectionFragments({ ...query, expression }),
      empty: emptyCanonicalValueFragmentSet,
      fragmentKey: canonicalValueFragmentKey,
      scalar: (query, expression) => resolution.scalarFragments({ ...query, expression }),
      slice: (fragment, startIndex) =>
        fragment.kind === "unregistered"
          ? fragment
          : { ...fragment, values: fragment.values.slice(startIndex) },
      toDomain: domainFromFragments,
    },
    input,
  );

const slicedValues = (
  fact: CanonicalValueDomainFact,
  startIndex: number,
): CandidateSet<CanonicalValueDomainFact> => {
  if (fact.kind !== "values") return unknownCandidateSet();
  return closedCandidateSet(
    [{ ...fact, values: fact.values.slice(startIndex) }],
    canonicalValueDomainFactIdentity,
  );
};

const indexedValues = (
  fact: CanonicalValueDomainFact,
  path: readonly (string | symbol)[],
): CandidateSet<CanonicalValueDomainFact> => {
  if (fact.kind !== "values") return unknownCandidateSet();
  const [property] = path;
  const index =
    path.length === 1 && typeof property === "string" ? canonicalValueArrayIndexOf(property) : null;
  return index === null
    ? unknownCandidateSet()
    : closedCandidateSet(
        [{ ...fact, values: fact.values.slice(index, index + 1) }],
        canonicalValueDomainFactIdentity,
      );
};

const projectCollectionFact = (
  resolution: LocalCollectionResolution,
  input: {
    readonly fact: CanonicalValueDomainFact;
    readonly projection: CanonicalValueOriginProjection;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (input.projection.kind === "array-element" || input.projection.kind === "property-name") {
    return closedCandidateSet([input.fact], canonicalValueDomainFactIdentity);
  }
  if (input.projection.kind === "array-transform") {
    return resolveCanonicalValueArrayResultTransform(resolution, {
      fact: input.fact,
      projection: input.projection,
      query: input.query,
    });
  }
  if (input.projection.kind === "array-slice") {
    return slicedValues(input.fact, input.projection.startIndex);
  }
  return input.projection.kind === "property"
    ? indexedValues(input.fact, input.projection.path)
    : unknownCandidateSet();
};

const projectedPropertyNames = (
  environment: LocalCollectionEnvironment,
  origin: CanonicalValueExpressionOrigin,
): CandidateSet<CanonicalValueDomainFact> =>
  resolveCanonicalValuePropertyNameOriginsDomain(environment, {
    keySemantics: "object-keys",
    origins: closedCandidateSet(
      [canonicalValueExpressionOrigin(origin.expression)],
      canonicalValueOriginKey,
    ),
  });

const projectedCollectionBase = (
  resolution: LocalCollectionResolution,
  input: {
    readonly firstProjection: CanonicalValueOriginProjection | undefined;
    readonly next: CanonicalValueCollectionQuery;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly yields: ReturnType<LocalCollectionEnvironment["bindingIndex"]["iterableYieldResults"]>;
  },
): CandidateSet<CanonicalValueDomainFact> | null => {
  if (input.firstProjection?.kind === "static-values") {
    return closedCandidateSet(
      [
        {
          derivedFromRegisteredRoute: false,
          kind: "values",
          localContribution: true,
          node: input.origin.expression,
          values: input.firstProjection.values,
        },
      ],
      canonicalValueDomainFactIdentity,
    );
  }
  if (input.yields.length !== 0) {
    return callArgumentsDomain(resolution, {
      expression: input.origin.expression,
      projection: {
        kind: "call-arguments",
        segments: canonicalValueYieldCallArgumentSegments(input.yields),
        startIndex: 0,
      },
      query: input.next,
    });
  }
  if (input.firstProjection?.kind === "call-arguments") {
    return callArgumentsDomain(resolution, {
      expression: input.origin.expression,
      projection: input.firstProjection,
      query: input.next,
    });
  }
  if (input.firstProjection?.kind === "property-name") {
    return projectedPropertyNames(resolution.environment, input.origin);
  }
  return null;
};

const localCollectionBase = (
  resolution: LocalCollectionResolution,
  input: {
    readonly firstProjection: CanonicalValueOriginProjection | undefined;
    readonly next: CanonicalValueCollectionQuery;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly propertyNames: CandidateSet<CanonicalValueDomainFact> | null;
    readonly yields: ReturnType<LocalCollectionEnvironment["bindingIndex"]["iterableYieldResults"]>;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const projected = projectedCollectionBase(resolution, input);
  if (projected !== null) return projected;
  if (input.origin.expression.type === "ArrayExpression") {
    return directArray(resolution, { ...input.next, expression: input.origin.expression });
  }
  return input.propertyNames ?? unknownCandidateSet();
};

const firstProjectionIsConsumed = (
  projection: CanonicalValueOriginProjection | undefined,
): boolean =>
  projection?.kind === "call-arguments" ||
  projection?.kind === "property-name" ||
  projection?.kind === "static-values";

export const resolveCanonicalValueLocalCollectionDomain = (
  input: LocalCollectionResolution & {
    readonly origin: CanonicalValueExpressionOrigin;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (input.query.seenExpressions.has(input.origin.expression)) return unknownCandidateSet();
  const next = {
    ...input.query,
    expression: input.origin.expression,
    seenExpressions: new Set([...input.query.seenExpressions, input.origin.expression]),
  };
  const [firstProjection, ...remainingProjections] = input.origin.projections;
  const propertyNames = resolveCanonicalValueObjectKeysDomain(
    input.environment,
    input.origin.expression,
  );
  const consumesIterable =
    firstProjection?.kind === "array-element" ||
    input.query.expression.parent.type === "SpreadElement";
  const base = localCollectionBase(input, {
    firstProjection,
    next,
    origin: input.origin,
    propertyNames,
    yields: consumesIterable
      ? input.environment.bindingIndex.iterableYieldResults(input.origin.expression)
      : [],
  });
  const projections = firstProjectionIsConsumed(firstProjection)
    ? remainingProjections
    : input.origin.projections;
  return projections.reduce<CandidateSet<CanonicalValueDomainFact>>((facts, projection) => {
    return flatMapCandidateSet(facts, {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (fact) => projectCollectionFact(input, { fact, projection, query: next }),
    });
  }, base);
};
