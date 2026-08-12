import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { resolveCanonicalValueArrayFilterDomain } from "./canonical-value-array-filter-domain.ts";
import { resolveCanonicalValueArrayReduceDomain } from "./canonical-value-array-reduce-domain.ts";
import {
  type CanonicalValueCollectionQuery,
  type CanonicalValueCollectionResolution,
} from "./canonical-value-collection-query.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOriginProjection } from "./canonical-value-property-origin.ts";

type ArrayTransformProjection = Extract<
  CanonicalValueOriginProjection,
  { readonly kind: "array-transform" }
>;

export const canonicalValueArrayResultTransformMethod = (
  method: string,
): "filter" | "slice" | "to-spliced" | "with" | null =>
  method === "slice" || method === "with" || method === "filter"
    ? method
    : method === "toSpliced"
      ? "to-spliced"
      : null;

type PrimitiveVector = readonly CanonicalValueStaticPrimitive[];

const primitiveVectorKey = (vector: PrimitiveVector): string =>
  vector.map(canonicalValueStaticPrimitiveKey).join("|");

const directArgumentPrimitives = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<PrimitiveVector> =>
  mapCandidateSet(
    resolution.environment.propertyState.primitives({
      cutoff: input.query.cutoff,
      executionContext: input.query.executionContext,
      expression: input.expression,
    }),
    {
      candidateKey: primitiveVectorKey,
      mapCandidate: (primitive) => [primitive],
    },
  );

const spreadArgumentPrimitives = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<PrimitiveVector> =>
  flatMapCandidateSet(
    resolution.collectionFragments({ ...input.query, expression: input.expression }),
    {
      candidateKey: primitiveVectorKey,
      mapCandidate: (fragment) =>
        fragment.kind === "fragment"
          ? closedCandidateSet([fragment.values], primitiveVectorKey)
          : unknownCandidateSet(),
    },
  );

const argumentPrimitives = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly argument: ESTree.Argument;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<PrimitiveVector> =>
  input.argument.type === "SpreadElement"
    ? spreadArgumentPrimitives(resolution, {
        expression: input.argument.argument,
        query: input.query,
      })
    : directArgumentPrimitives(resolution, {
        expression: input.argument,
        query: input.query,
      });

const argumentVectors = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly arguments: readonly ESTree.Argument[];
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<PrimitiveVector> =>
  input.arguments.reduce<CandidateSet<PrimitiveVector>>(
    (vectors, argument) =>
      appendCandidateSets({
        accumulated: vectors,
        append: (left, right) => [...left, ...right],
        candidateKey: primitiveVectorKey,
        next: argumentPrimitives(resolution, { argument, query: input.query }),
      }),
    closedCandidateSet([[]], primitiveVectorKey),
  );

const toIntegerOrInfinity = (value: CanonicalValueStaticPrimitive): number | null => {
  if (typeof value === "bigint") return null;
  const number = Number(value);
  if (Number.isNaN(number) || number === 0) return 0;
  if (!Number.isFinite(number)) return number;
  return Math.trunc(number);
};

const relativeIndex = (index: number, length: number): number =>
  index < 0 ? Math.max(length + index, 0) : Math.min(index, length);

const sliceValues = (
  values: readonly CanonicalValue[],
  arguments_: PrimitiveVector,
): readonly CanonicalValue[] | null => {
  const start = arguments_[0] === undefined ? 0 : toIntegerOrInfinity(arguments_[0]);
  const end = arguments_.length < 2 ? values.length : toIntegerOrInfinity(arguments_[1]);
  if (start === null || end === null) return null;
  return values.slice(relativeIndex(start, values.length), relativeIndex(end, values.length));
};

const canonicalItems = (
  primitives: readonly CanonicalValueStaticPrimitive[],
): readonly CanonicalValue[] | null =>
  primitives.every(
    (primitive): primitive is CanonicalValue =>
      primitive !== undefined && typeof primitive !== "bigint",
  )
    ? primitives
    : null;

const toSplicedBounds = (
  length: number,
  arguments_: PrimitiveVector,
): { readonly actualDeleteCount: number; readonly actualStart: number } | null => {
  const startPrimitive = arguments_[0];
  const start = startPrimitive === undefined ? 0 : toIntegerOrInfinity(startPrimitive);
  if (start === null) return null;
  const actualStart = relativeIndex(start, length);
  const deletePrimitive = arguments_[1];
  const deleteCount =
    arguments_.length < 2
      ? length - actualStart
      : deletePrimitive === undefined
        ? 0
        : toIntegerOrInfinity(deletePrimitive);
  if (deleteCount === null) return null;
  return {
    actualDeleteCount: Math.min(Math.max(deleteCount, 0), length - actualStart),
    actualStart,
  };
};

const toSplicedValues = (
  values: readonly CanonicalValue[],
  arguments_: PrimitiveVector,
): readonly CanonicalValue[] | null => {
  const bounds = toSplicedBounds(values.length, arguments_);
  if (bounds === null) return null;
  const items = canonicalItems(arguments_.slice(2));
  if (items === null) return null;
  return [
    ...values.slice(0, bounds.actualStart),
    ...items,
    ...values.slice(bounds.actualStart + bounds.actualDeleteCount),
  ];
};

const withValues = (
  values: readonly CanonicalValue[],
  arguments_: PrimitiveVector,
): readonly CanonicalValue[] | null => {
  const indexPrimitive = arguments_[0];
  if (indexPrimitive === undefined || arguments_.length < 2) return null;
  const index = toIntegerOrInfinity(indexPrimitive);
  const replacement = canonicalItems(arguments_.slice(1, 2));
  if (index === null || replacement === null) return null;
  const actualIndex = index < 0 ? values.length + index : index;
  if (actualIndex < 0 || actualIndex >= values.length) return null;
  return values.map((value, candidateIndex) =>
    candidateIndex === actualIndex ? (replacement[0] ?? value) : value,
  );
};

const transformedValues = (
  projection: ArrayTransformProjection,
  input: { readonly arguments: PrimitiveVector; readonly values: readonly CanonicalValue[] },
): readonly CanonicalValue[] | null => {
  if (projection.method === "slice") return sliceValues(input.values, input.arguments);
  if (projection.method === "to-spliced") return toSplicedValues(input.values, input.arguments);
  return projection.method === "with" ? withValues(input.values, input.arguments) : null;
};

const transformedFact = (
  fact: Extract<CanonicalValueDomainFact, { readonly kind: "values" }>,
  input: { readonly arguments: PrimitiveVector; readonly projection: ArrayTransformProjection },
): CandidateSet<CanonicalValueDomainFact> => {
  const transformedDomain = transformedValues(input.projection, {
    arguments: input.arguments,
    values: fact.values,
  });
  if (transformedDomain === null) return unknownCandidateSet();
  const changed = fingerprintValues(transformedDomain) !== fingerprintValues(fact.values);
  return closedCandidateSet(
    [{ ...fact, localContribution: fact.localContribution || changed, values: transformedDomain }],
    canonicalValueDomainFactIdentity,
  );
};

export const resolveCanonicalValueArrayResultTransform = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly fact: CanonicalValueDomainFact;
    readonly projection: ArrayTransformProjection;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (input.projection.method === "filter") {
    return input.query.expression.type === "CallExpression"
      ? resolveCanonicalValueArrayFilterDomain(resolution.environment, {
          call: input.query.expression,
          fact: input.fact,
          query: input.query,
        })
      : unknownCandidateSet();
  }
  if (input.projection.method === "reduce" || input.projection.method === "reduce-right") {
    return input.query.expression.type === "CallExpression"
      ? resolveCanonicalValueArrayReduceDomain(resolution, {
          call: input.query.expression,
          fact: input.fact,
          fromRight: input.projection.method === "reduce-right",
          query: input.query,
        })
      : unknownCandidateSet();
  }
  if (input.fact.kind === "unregistered") {
    return openCandidateSet([input.fact], canonicalValueDomainFactIdentity);
  }
  if (input.fact.kind !== "values") return unknownCandidateSet();
  const fact = input.fact;
  const vectors = argumentVectors(resolution, {
    arguments: input.projection.arguments,
    query: input.query,
  });
  return flatMapCandidateSet(vectors, {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (arguments_) =>
      transformedFact(fact, { arguments: arguments_, projection: input.projection }),
  });
};
