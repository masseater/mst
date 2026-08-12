import {
  closedCandidateSet,
  filterCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { resolveCanonicalValueInvocationArgumentOrigins } from "./canonical-value-invocation-arguments.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-path.ts";
import {
  appendCanonicalValueInvocationSegments,
  canonicalValueDirectInvocationArguments,
  canonicalValueDirectInvocationSegments,
} from "./canonical-value-invocation-segments.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueInvocationArgumentSegment,
  CanonicalValueInvocationFact,
  CanonicalValueInvocationInternals,
} from "./canonical-value-invocation-types.ts";

type NestedInvocationRuntime = {
  readonly factKey: (fact: CanonicalValueInvocationFact) => string;
  readonly resolveCallable: (
    expression: ESTree.Expression,
  ) => CandidateSet<CanonicalValueCallableCandidate>;
  readonly resolveOriginCallable: (
    origin: CanonicalValueExpressionOrigin,
  ) => CandidateSet<CanonicalValueCallableCandidate>;
  readonly state: CanonicalValueInvocationInternals;
};

type NestedInvocationInput = {
  readonly fact: CanonicalValueInvocationFact;
  readonly seen: ReadonlySet<string>;
};

export const canonicalValueIsGlobalFunctionMethod = (
  state: CanonicalValueInvocationInternals,
  input: { readonly method: "apply" | "call"; readonly origin: CanonicalValueExpressionOrigin },
): boolean => {
  const path = canonicalValueInvocationPropertyPath(input.origin);
  if (path?.length === 2 && path[0] === "prototype" && path[1] === input.method) {
    return canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: input.origin.expression,
      name: "Function",
    });
  }
  return (
    path?.length === 3 &&
    path[0] === "Function" &&
    path[1] === "prototype" &&
    path[2] === input.method &&
    canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: input.origin.expression,
      name: "globalThis",
    })
  );
};

const isGlobalReflectApply = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path?.length === 1 && path[0] === "apply") {
    return canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "Reflect",
    });
  }
  return (
    path?.length === 2 &&
    path[0] === "Reflect" &&
    path[1] === "apply" &&
    canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "globalThis",
    })
  );
};

const invocationArgumentExpressionOrigins = (
  state: CanonicalValueInvocationInternals,
  input: { readonly fact: CanonicalValueInvocationFact; readonly index: number },
): CandidateSet<CanonicalValueExpressionOrigin> =>
  flatMapCandidateSet(
    resolveCanonicalValueInvocationArgumentOrigins(state, {
      index: input.index,
      segments: input.fact.argumentSegments,
    }),
    {
      candidateKey: canonicalValueOriginKey,
      mapCandidate: (origin) =>
        origin.kind === "absent"
          ? unknownCandidateSet<CanonicalValueExpressionOrigin>()
          : closedCandidateSet([origin], canonicalValueOriginKey),
    },
  );

const invokedCallableFact = (
  runtime: NestedInvocationRuntime,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
    readonly thisArgument: ESTree.Expression | null;
  },
): CandidateSet<CanonicalValueInvocationFact> =>
  closedCandidateSet(
    [
      {
        argumentSegments: appendCanonicalValueInvocationSegments(
          input.callable.argumentSegments,
          input.segments,
        ),
        target: input.callable.target,
        thisArgument: input.callable.boundThis ?? input.thisArgument,
      },
    ],
    runtime.factKey,
  );

const normalizeCallableFact = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput & {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
    readonly thisArgument: ESTree.Expression | null;
  },
): CandidateSet<CanonicalValueInvocationFact> =>
  flatMapCandidateSet(invokedCallableFact(runtime, input), {
    candidateKey: runtime.factKey,
    mapCandidate: (fact) =>
      normalizeCanonicalValueNestedInvocationFact(runtime, { fact, seen: input.seen }),
  });

const normalizeGlobalFunctionCall = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput,
): CandidateSet<CanonicalValueInvocationFact> => {
  const items = canonicalValueDirectInvocationArguments(input.fact.argumentSegments);
  const target = input.fact.thisArgument;
  if (items === null || target === null || items[0]?.type === "SpreadElement") {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(runtime.resolveCallable(target), {
    candidateKey: runtime.factKey,
    mapCandidate: (callable) =>
      normalizeCallableFact(runtime, {
        ...input,
        callable,
        segments: canonicalValueDirectInvocationSegments(items.slice(1)),
        thisArgument: canonicalValueArgumentExpression(items[0]),
      }),
  });
};

const normalizeGlobalFunctionApply = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput,
): CandidateSet<CanonicalValueInvocationFact> => {
  const items = canonicalValueDirectInvocationArguments(input.fact.argumentSegments);
  const target = input.fact.thisArgument;
  const argumentArray = items === null ? null : canonicalValueArgumentExpression(items[1]);
  if (items === null || target === null || argumentArray === null) return unknownCandidateSet();
  return flatMapCandidateSet(runtime.resolveCallable(target), {
    candidateKey: runtime.factKey,
    mapCandidate: (callable) =>
      normalizeCallableFact(runtime, {
        ...input,
        callable,
        segments: [{ expression: argumentArray, kind: "array" }],
        thisArgument: canonicalValueArgumentExpression(items[0]),
      }),
  });
};

const normalizeReflectCallable = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput & {
    readonly argumentArrays: CandidateSet<CanonicalValueExpressionOrigin>;
    readonly callable: CanonicalValueCallableCandidate;
    readonly thisArguments: CandidateSet<CanonicalValueExpressionOrigin>;
  },
): CandidateSet<CanonicalValueInvocationFact> =>
  flatMapCandidateSet(input.thisArguments, {
    candidateKey: runtime.factKey,
    mapCandidate: (thisArgument) =>
      flatMapCandidateSet(input.argumentArrays, {
        candidateKey: runtime.factKey,
        mapCandidate: (argumentArray) =>
          normalizeCallableFact(runtime, {
            ...input,
            segments: [{ expression: argumentArray.expression, kind: "array" }],
            thisArgument: thisArgument.expression,
          }),
      }),
  });

const normalizeGlobalReflectApply = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput,
): CandidateSet<CanonicalValueInvocationFact> => {
  const targets = invocationArgumentExpressionOrigins(runtime.state, {
    fact: input.fact,
    index: 0,
  });
  const thisArguments = invocationArgumentExpressionOrigins(runtime.state, {
    fact: input.fact,
    index: 1,
  });
  const argumentArrays = filterCandidateSet(
    invocationArgumentExpressionOrigins(runtime.state, { fact: input.fact, index: 2 }),
    (origin) => origin.projections.length === 0,
  );
  return flatMapCandidateSet(targets, {
    candidateKey: runtime.factKey,
    mapCandidate: (target) =>
      flatMapCandidateSet(runtime.resolveOriginCallable(target), {
        candidateKey: runtime.factKey,
        mapCandidate: (callable) =>
          normalizeReflectCallable(runtime, {
            ...input,
            argumentArrays,
            callable,
            thisArguments,
          }),
      }),
  });
};

export const normalizeCanonicalValueNestedInvocationFact = (
  runtime: NestedInvocationRuntime,
  input: NestedInvocationInput,
): CandidateSet<CanonicalValueInvocationFact> => {
  const key = runtime.factKey(input.fact);
  if (input.seen.has(key)) return unknownCandidateSet();
  const nested = { fact: input.fact, seen: new Set([...input.seen, key]) };
  if (
    canonicalValueIsGlobalFunctionMethod(runtime.state, {
      method: "call",
      origin: input.fact.target,
    })
  ) {
    return normalizeGlobalFunctionCall(runtime, nested);
  }
  if (
    canonicalValueIsGlobalFunctionMethod(runtime.state, {
      method: "apply",
      origin: input.fact.target,
    })
  ) {
    return normalizeGlobalFunctionApply(runtime, nested);
  }
  return isGlobalReflectApply(runtime.state, input.fact.target)
    ? normalizeGlobalReflectApply(runtime, nested)
    : closedCandidateSet([input.fact], runtime.factKey);
};
