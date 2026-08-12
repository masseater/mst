import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  type CanonicalValue,
} from "../lib/canonical-values/fingerprint.ts";
import {
  SCHEMA_LITERAL_MEMBER,
  unwrapExpression,
} from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueSchemaUnion = {
  readonly node: ESTree.ArrayExpression;
  readonly values: readonly CanonicalValue[];
};

type SchemaUnionEnvironment = {
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
};

const literalSequenceKey = (sequence: CanonicalValueSchemaUnion): string =>
  `${sequence.node.start}:${fingerprintValues(sequence.values)}`;

const valueSequenceKey = (values: readonly CanonicalValue[]): string => fingerprintValues(values);

const canonicalPrimitive = (primitive: unknown): CanonicalValue | symbol =>
  primitive === null ||
  typeof primitive === "string" ||
  typeof primitive === "number" ||
  typeof primitive === "boolean"
    ? primitive
    : Symbol.for("non-canonical-primitive");

const literalInvocationValues = (
  environment: SchemaUnionEnvironment,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValue> => {
  const call = unwrapExpression(expression);
  if (call.type !== "CallExpression") return unknownCandidateSet();
  const invocations = environment.invocationState.recognized(call);
  if (
    invocations.candidates.length === 0 ||
    invocations.candidates.some(
      (invocation) =>
        invocation.target.kind !== "schema" || invocation.target.member !== SCHEMA_LITERAL_MEMBER,
    )
  ) {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(invocations, {
    candidateKey: canonicalValueKey,
    mapCandidate: (invocation) =>
      flatMapCandidateSet(environment.invocationState.argumentOrigins(invocation, 0), {
        candidateKey: canonicalValueKey,
        mapCandidate: (origin) => {
          if (origin.kind === "absent" || origin.projections.length !== 0) {
            return unknownCandidateSet();
          }
          const primitives = environment.propertyState.primitives({
            expression: origin.expression,
          });
          return flatMapCandidateSet(primitives, {
            candidateKey: canonicalValueKey,
            mapCandidate: (primitive) => {
              const canonicalItem = canonicalPrimitive(primitive);
              return typeof canonicalItem === "symbol"
                ? unknownCandidateSet()
                : closedCandidateSet([canonicalItem], canonicalValueKey);
            },
          });
        },
      }),
  });
};

const appendValues = (
  accumulated: CandidateSet<readonly CanonicalValue[]>,
  values: CandidateSet<CanonicalValue>,
): CandidateSet<readonly CanonicalValue[]> =>
  appendSequences(
    accumulated,
    mapCandidateSet(values, {
      candidateKey: valueSequenceKey,
      mapCandidate: (value) => [value],
    }),
  );

const appendSequences = (
  accumulated: CandidateSet<readonly CanonicalValue[]>,
  values: CandidateSet<readonly CanonicalValue[]>,
): CandidateSet<readonly CanonicalValue[]> =>
  appendCandidateSets({
    accumulated,
    append: (prefix, suffix) => [...prefix, ...suffix],
    candidateKey: valueSequenceKey,
    next: values,
  });

const arraySliceStart = (origin: CanonicalValueOrigin): number | null => {
  if (origin.kind === "absent") return null;
  if (origin.projections.some((projection) => projection.kind !== "array-slice")) return null;
  return origin.projections.reduce(
    (startIndex, projection) =>
      startIndex + (projection.kind === "array-slice" ? projection.startIndex : 0),
    0,
  );
};

const valuesFromElements = (
  environment: SchemaUnionEnvironment,
  elements: readonly ESTree.ArrayExpression["elements"][number][],
): CandidateSet<readonly CanonicalValue[]> =>
  elements.reduce<CandidateSet<readonly CanonicalValue[]>>(
    (accumulated, element) => {
      if (element === null) return unknownCandidateSet();
      if (element.type !== "SpreadElement") {
        return appendValues(accumulated, literalInvocationValues(environment, element));
      }
      const spreadValues = flatMapCandidateSet(
        environment.propertyState.origins({ expression: element.argument }),
        {
          candidateKey: valueSequenceKey,
          mapCandidate: (origin) =>
            flatMapCandidateSet(sequenceFromOrigin(environment, origin), {
              candidateKey: valueSequenceKey,
              mapCandidate: (sequence) => closedCandidateSet([sequence.values], valueSequenceKey),
            }),
        },
      );
      return appendSequences(accumulated, spreadValues);
    },
    closedCandidateSet([[]], valueSequenceKey),
  );

const sequenceFromOrigin = (
  environment: SchemaUnionEnvironment,
  origin: CanonicalValueOrigin,
): CandidateSet<CanonicalValueSchemaUnion> => {
  if (origin.kind === "absent") return unknownCandidateSet();
  const expression = unwrapExpression(origin.expression);
  const startIndex = arraySliceStart(origin);
  if (expression.type !== "ArrayExpression" || startIndex === null) return unknownCandidateSet();
  return flatMapCandidateSet(
    valuesFromElements(environment, expression.elements.slice(startIndex)),
    {
      candidateKey: literalSequenceKey,
      mapCandidate: (values) =>
        closedCandidateSet([{ node: expression, values }], literalSequenceKey),
    },
  );
};

export const resolveCanonicalValueSchemaUnionOrigins = (
  environment: SchemaUnionEnvironment,
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueSchemaUnion> =>
  flatMapCandidateSet(origins, {
    candidateKey: literalSequenceKey,
    mapCandidate: (origin) => sequenceFromOrigin(environment, origin),
  });
