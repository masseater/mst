import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { type CanonicalValueStaticResolutionContext } from "./canonical-value-static-invocation-types.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type {
  CanonicalValueOrigin,
  CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueStaticPrimitiveVector = readonly CanonicalValueStaticPrimitive[];
export type CanonicalValueStaticPrimitiveEvaluator = (
  arguments_: CanonicalValueStaticPrimitiveVector,
) => CanonicalValueStaticPrimitive;

type StaticArrayEnvironment = {
  readonly propertyState: CanonicalValuePropertyState;
};

export const canonicalValueStaticPrimitiveVectorKey = (
  vector: CanonicalValueStaticPrimitiveVector,
): string => JSON.stringify(vector.map(canonicalValueStaticPrimitiveKey));

const appendPrimitiveVectors = (
  accumulated: CandidateSet<CanonicalValueStaticPrimitiveVector>,
  next: CandidateSet<CanonicalValueStaticPrimitiveVector>,
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  appendCandidateSets({
    accumulated,
    append: (left, right) => [...left, ...right],
    candidateKey: canonicalValueStaticPrimitiveVectorKey,
    next,
  });

const primitiveVector = (
  primitives: CandidateSet<CanonicalValueStaticPrimitive>,
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  mapCandidateSet(primitives, {
    candidateKey: canonicalValueStaticPrimitiveVectorKey,
    mapCandidate: (primitive) => [primitive],
  });

const projectedArrayOffset = (
  projections: readonly CanonicalValueOriginProjection[],
): number | null => {
  if (!projections.every((projection) => projection.kind === "array-slice")) return null;
  return projections.reduce((offset, projection) => offset + projection.startIndex, 0);
};

const arrayElementVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly element: ESTree.ArrayExpression["elements"][number];
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitiveVector> => {
  if (input.element === null) {
    return closedCandidateSet([[undefined]], canonicalValueStaticPrimitiveVectorKey);
  }
  return input.element.type === "SpreadElement"
    ? resolveCanonicalValueStaticArrayVectors(environment, {
        ...input,
        expression: input.element.argument,
      })
    : primitiveVector(
        input.resolve({
          ...input.query,
          expression: input.element,
        }),
      );
};

const arrayExpressionVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly expression: ESTree.ArrayExpression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  input.expression.elements.reduce<CandidateSet<CanonicalValueStaticPrimitiveVector>>(
    (vectors, element) =>
      appendPrimitiveVectors(vectors, arrayElementVectors(environment, { ...input, element })),
    closedCandidateSet([[]], canonicalValueStaticPrimitiveVectorKey),
  );

export const resolveCanonicalValueStaticArrayOriginVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly origin: CanonicalValueOrigin;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitiveVector> => {
  if (input.origin.kind === "absent") {
    return unknownCandidateSet();
  }
  const [staticProjection] = input.origin.projections;
  if (input.origin.projections.length === 1 && staticProjection?.kind === "static-values") {
    return closedCandidateSet([staticProjection.values], canonicalValueStaticPrimitiveVectorKey);
  }
  if (input.origin.expression.type !== "ArrayExpression") return unknownCandidateSet();
  const offset = projectedArrayOffset(input.origin.projections);
  if (offset === null) return unknownCandidateSet();
  return mapCandidateSet(
    arrayExpressionVectors(environment, {
      ...input,
      expression: input.origin.expression,
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveVectorKey,
      mapCandidate: (vector) => vector.slice(offset),
    },
  );
};

export const resolveCanonicalValueStaticArrayVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitiveVector> => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return unknownCandidateSet();
  const seen = new Set([...input.seen, expression]);
  return flatMapCandidateSet(
    environment.propertyState.origins({
      cutoff: input.query.cutoff,
      executionContext: input.query.executionContext,
      expression,
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveVectorKey,
      mapCandidate: (origin) =>
        resolveCanonicalValueStaticArrayOriginVectors(environment, { ...input, origin, seen }),
    },
  );
};

const directArgumentVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly elements: readonly ESTree.Argument[];
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  input.elements.reduce<CandidateSet<CanonicalValueStaticPrimitiveVector>>(
    (vectors, element) => {
      const next =
        element.type === "SpreadElement"
          ? resolveCanonicalValueStaticArrayVectors(environment, {
              ...input,
              expression: element.argument,
            })
          : primitiveVector(input.resolve({ ...input.query, expression: element }));
      return appendPrimitiveVectors(vectors, next);
    },
    closedCandidateSet([[]], canonicalValueStaticPrimitiveVectorKey),
  );

export const resolveCanonicalValueStaticInvocationArgumentVectors = (
  environment: StaticArrayEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  input.fact.argumentSegments.reduce<CandidateSet<CanonicalValueStaticPrimitiveVector>>(
    (vectors, segment) => {
      const next =
        segment.kind === "array"
          ? resolveCanonicalValueStaticArrayVectors(environment, {
              ...input,
              expression: segment.expression,
              seen: new Set(),
            })
          : segment.kind === "direct"
            ? directArgumentVectors(environment, {
                ...input,
                elements: segment.elements,
                seen: new Set(),
              })
            : unknownCandidateSet<CanonicalValueStaticPrimitiveVector>();
      return appendPrimitiveVectors(vectors, next);
    },
    closedCandidateSet([[]], canonicalValueStaticPrimitiveVectorKey),
  );
