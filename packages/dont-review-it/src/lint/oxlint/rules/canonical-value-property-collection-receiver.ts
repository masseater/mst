import { cartesianProduct } from "es-toolkit";

import {
  closedCandidateSet,
  flatMapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueArrayResultTransformMethod } from "./canonical-value-array-result-transform.ts";
import { canonicalValueLogicalInvocationArguments } from "./canonical-value-invocation-segments.ts";
import {
  appendCanonicalValueOriginPath,
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { canonicalValueSplitVector } from "./canonical-value-property-split.ts";
import { canonicalValuePropertyReceiverTarget } from "./canonical-value-property-standard-target.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation-types.ts";
import type {
  CanonicalValuePropertyInternals,
  CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";

type ReceiverInput = CanonicalValueResolvedPropertyQuery & {
  readonly expression: ESTree.CallExpression;
  readonly fact: CanonicalValueInvocationFact;
};

const resultOrigin = (
  input: ReceiverInput,
  projections: Parameters<typeof canonicalValueExpressionOrigin>[1],
): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet(
    [
      appendCanonicalValueOriginPath(
        canonicalValueExpressionOrigin(input.expression, projections),
        input.path,
      ),
    ],
    canonicalValueOriginKey,
  );

const primitiveForOrigin = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput & { readonly origin: CanonicalValueOrigin },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  input.origin.kind === "absent" || input.origin.projections.length !== 0
    ? unknownCandidateSet()
    : state.staticResolver.primitives({
        cutoff: input.cutoff,
        executionContext: input.executionContext,
        expression: input.origin.expression,
      });

const factArgumentPrimitives = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput & {
    readonly fallback: CanonicalValueStaticPrimitive;
    readonly index: number;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(state.invocationArgumentOrigins(input.fact, input.index), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (origin) =>
      origin.kind === "absent"
        ? closedCandidateSet([input.fallback], canonicalValueStaticPrimitiveKey)
        : primitiveForOrigin(state, { ...input, origin }),
  });

const splitOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): CandidateSet<CanonicalValueOrigin> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  const receivers = state.staticResolver.primitives({
    cutoff: input.cutoff,
    executionContext: input.executionContext,
    expression: input.fact.thisArgument,
  });
  const separators = factArgumentPrimitives(state, {
    ...input,
    fallback: undefined,
    index: 0,
  });
  const limits = factArgumentPrimitives(state, { ...input, fallback: undefined, index: 1 });
  const origins = cartesianProduct(
    receivers.candidates,
    separators.candidates,
    limits.candidates,
  ).flatMap(([receiver, separator, limit]) => {
    if (typeof receiver !== "string") return [];
    const splitItems = canonicalValueSplitVector({ limit, receiver, separator });
    return splitItems === null
      ? []
      : [
          appendCanonicalValueOriginPath(
            canonicalValueExpressionOrigin(input.expression, [
              { kind: "static-values", values: splitItems },
            ]),
            input.path,
          ),
        ];
  });
  const complete = receivers.complete && separators.complete && limits.complete;
  return complete
    ? closedCandidateSet(origins, canonicalValueOriginKey)
    : openCandidateSet(origins, canonicalValueOriginKey);
};

const originIsArray = (origin: CanonicalValueOrigin): boolean => {
  if (origin.kind === "absent") return false;
  if (
    origin.projections.some(
      (projection) =>
        projection.kind === "array-element" ||
        projection.kind === "array-slice" ||
        projection.kind === "array-transform" ||
        projection.kind === "call-arguments" ||
        projection.kind === "static-values",
    )
  ) {
    return true;
  }
  const expression = unwrapExpression(origin.expression);
  return expression.type === "ArrayExpression" || expression.type === "NewExpression";
};

const receiverIsArray = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput & { readonly candidate: ESTree.Expression },
): boolean => {
  const origins = input.resolve(state, { ...input, expression: input.candidate, path: [] });
  return (
    origins.complete && origins.candidates.length !== 0 && origins.candidates.every(originIsArray)
  );
};

const concatSegments = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): readonly CanonicalValueCallArgumentSegment[] | null => {
  if (input.fact.thisArgument === null) return null;
  const arguments_ = canonicalValueLogicalInvocationArguments(input.fact);
  if (arguments_ === null) return null;
  return [
    { expression: input.fact.thisArgument, kind: "array" },
    ...arguments_.map((argument): CanonicalValueCallArgumentSegment => {
      if (argument.type === "SpreadElement") return { kind: "unknown" };
      return receiverIsArray(state, { ...input, candidate: argument })
        ? { expression: argument, kind: "array" }
        : { elements: [argument], kind: "direct" };
    }),
  ];
};

const concatResultOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): CandidateSet<CanonicalValueOrigin> => {
  const segments = concatSegments(state, input);
  return segments === null
    ? unknownCandidateSet()
    : resultOrigin(input, [{ kind: "call-arguments", segments, startIndex: 0 }]);
};

const arrayTransformOrigins = (
  input: ReceiverInput & {
    readonly method: "filter" | "slice" | "to-spliced" | "with";
  },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  const arguments_ = canonicalValueLogicalInvocationArguments(input.fact);
  return arguments_ === null
    ? unknownCandidateSet()
    : resultOrigin(input, [
        {
          kind: "call-arguments",
          segments: [{ expression: input.fact.thisArgument, kind: "array" }],
          startIndex: 0,
        },
        { arguments: arguments_, kind: "array-transform", method: input.method },
      ]);
};

const arrayCopyOrigins = (input: ReceiverInput): CandidateSet<CanonicalValueOrigin> =>
  input.fact.thisArgument === null
    ? unknownCandidateSet()
    : resultOrigin(input, [
        {
          kind: "call-arguments",
          segments: [{ expression: input.fact.thisArgument, kind: "array" }],
          startIndex: 0,
        },
      ]);

const receiverResultOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput & { readonly method: string },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  if (input.method === "split") return splitOrigins(state, input);
  if (input.method === "concat") return concatResultOrigins(state, input);
  const transformMethod = canonicalValueArrayResultTransformMethod(input.method);
  return transformMethod === null
    ? arrayCopyOrigins(input)
    : arrayTransformOrigins({ ...input, method: transformMethod });
};

const stringReceiverResolution = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  const target = canonicalValuePropertyReceiverTarget(state, {
    ...input,
    globalName: "String",
    method: "split",
  });
  return target === null
    ? null
    : target.stable
      ? receiverResultOrigins(state, { ...input, method: "split" })
      : unknownCandidateSet();
};

const arrayReceiverResolution = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  for (const method of [
    "concat",
    "filter",
    "slice",
    "toReversed",
    "toSorted",
    "toSpliced",
    "with",
  ] as const) {
    const target = canonicalValuePropertyReceiverTarget(state, {
      ...input,
      globalName: "Array",
      method,
    });
    if (target === null) continue;
    if (!target.stable) return unknownCandidateSet();
    const globalPath = canonicalValueStaticGlobalPropertyPath(state.bindingIndex, {
      name: "Array",
      origin: input.fact.target,
    });
    const receiver = input.fact.thisArgument;
    if (
      globalPath === null &&
      (receiver === null || !receiverIsArray(state, { ...input, candidate: receiver }))
    ) {
      return unknownCandidateSet();
    }
    return receiverResultOrigins(state, { ...input, method });
  }
  return null;
};

export const canonicalValueReceiverCollectionInvocationOrigins = (
  state: CanonicalValuePropertyInternals,
  input: ReceiverInput,
): CandidateSet<CanonicalValueOrigin> | null =>
  stringReceiverResolution(state, input) ?? arrayReceiverResolution(state, input);
