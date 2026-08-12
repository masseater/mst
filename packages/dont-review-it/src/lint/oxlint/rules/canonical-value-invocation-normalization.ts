import {
  absentCandidateSet,
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import { resolveCanonicalValueInvocationOrigins } from "./canonical-value-invocation-origin.ts";
import {
  appendCanonicalValueInvocationSegments,
  canonicalValueDirectInvocationArguments,
  canonicalValueDirectInvocationSegments,
} from "./canonical-value-invocation-segments.ts";
import {
  canonicalValueIsGlobalFunctionMethod,
  normalizeCanonicalValueNestedInvocationFact,
} from "./canonical-value-nested-invocation.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueInvocationArgumentSegment,
  CanonicalValueInvocationFact,
  CanonicalValueInvocationInternals,
} from "./canonical-value-invocation-types.ts";

const nodeKey = (node: ESTree.Node | null): string =>
  node === null ? "none" : `${node.start}:${node.end}`;

const segmentKey = (segment: CanonicalValueInvocationArgumentSegment): string =>
  segment.kind === "array"
    ? `array:${nodeKey(segment.expression)}`
    : segment.kind === "source"
      ? `source:${nodeKey(segment.expression)}:${segment.sourcePath
          .map((source) => source.kind)
          .join("/")}`
      : `direct:${segment.elements.map(nodeKey).join(",")}`;

const callableKey = (candidate: CanonicalValueCallableCandidate): string =>
  [
    canonicalValueOriginKey(candidate.target),
    nodeKey(candidate.boundThis),
    nodeKey(candidate.directThis),
    candidate.argumentSegments.map(segmentKey).join("|"),
  ].join(":");

export const canonicalValueInvocationFactKey = (fact: CanonicalValueInvocationFact): string =>
  [
    canonicalValueOriginKey(fact.target),
    nodeKey(fact.thisArgument),
    fact.argumentSegments.map(segmentKey).join("|"),
  ].join(":");

const replaceLastProjection = (
  origin: CanonicalValueExpressionOrigin,
  replacement: CanonicalValueOriginProjection | null,
): CanonicalValueExpressionOrigin =>
  canonicalValueExpressionOrigin(origin.expression, [
    ...origin.projections.slice(0, -1),
    ...(replacement === null ? [] : [replacement]),
  ]);

export const popCanonicalValueInvocationProperty = (
  origin: CanonicalValueExpressionOrigin,
  expected: string,
): CanonicalValueExpressionOrigin | null => {
  const projection = origin.projections.at(-1);
  if (projection?.kind !== "property" || projection.path.at(-1) !== expected) return null;
  const remaining = projection.path.slice(0, -1);
  return replaceLastProjection(
    origin,
    remaining.length === 0 ? null : { kind: "property", path: remaining },
  );
};

const directThisOf = (expression: ESTree.Expression): ESTree.Expression | null => {
  const unwrapped = unwrapExpression(expression);
  return unwrapped.type === "MemberExpression" && unwrapped.object.type !== "Super"
    ? unwrapped.object
    : null;
};

const directCallable = (
  origin: CanonicalValueExpressionOrigin,
  directThis: ESTree.Expression | null,
): CandidateSet<CanonicalValueCallableCandidate> =>
  closedCandidateSet(
    [{ argumentSegments: [], boundThis: null, directThis, target: origin }],
    callableKey,
  );

const resolveCallable = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueCallableCandidate> => {
  const unwrapped = unwrapExpression(expression);
  const executionContext = state.bindingIndex.executionContextAt(unwrapped);
  const entry = state.callableMemo.enter({
    cutoff: unwrapped.start,
    domain: "callable",
    executionContext,
    identity: unwrapped,
    path: [],
  });
  if (entry.kind === "cycle") return unknownCandidateSet();
  if (entry.kind === "cached") return entry.value;
  const candidates = resolveCallableUncached(state, unwrapped);
  entry.complete(candidates);
  return candidates;
};

const bindCandidate = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly call: ESTree.CallExpression;
    readonly callable: CanonicalValueCallableCandidate;
  },
): CandidateSet<CanonicalValueCallableCandidate> => {
  const base = popCanonicalValueInvocationProperty(input.callable.target, "bind");
  if (base === null || input.call.arguments[0]?.type === "SpreadElement") {
    return unknownCandidateSet();
  }
  const boundThis = canonicalValueArgumentExpression(input.call.arguments[0]);
  return flatMapCandidateSet(resolveOriginCallable(state, { directThis: null, origin: base }), {
    candidateKey: callableKey,
    mapCandidate: (target) =>
      closedCandidateSet(
        [
          {
            ...target,
            argumentSegments: appendCanonicalValueInvocationSegments(
              target.argumentSegments,
              canonicalValueDirectInvocationSegments(input.call.arguments.slice(1)),
            ),
            boundThis: target.boundThis ?? boundThis,
            directThis: null,
          },
        ],
        callableKey,
      ),
  });
};

const resolveBoundCall = (
  state: CanonicalValueInvocationInternals,
  call: ESTree.CallExpression,
): CandidateSet<CanonicalValueCallableCandidate> =>
  flatMapCandidateSet(resolveCallable(state, call.callee), {
    candidateKey: callableKey,
    mapCandidate: (callable) => bindCandidate(state, { call, callable }),
  });

const resolveOriginCallable = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly directThis: ESTree.Expression | null;
    readonly origin: CanonicalValueExpressionOrigin;
  },
): CandidateSet<CanonicalValueCallableCandidate> => {
  if (input.origin.projections.length !== 0 || input.origin.expression.type !== "CallExpression") {
    return directCallable(input.origin, input.directThis);
  }
  const bound = resolveBoundCall(state, input.origin.expression);
  return bound.candidates.length === 0 ? directCallable(input.origin, input.directThis) : bound;
};

const resolveCallableUncached = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueCallableCandidate> =>
  flatMapCandidateSet(resolveCanonicalValueInvocationOrigins(state.propertyState, expression), {
    candidateKey: callableKey,
    mapCandidate: (origin) =>
      origin.kind === "absent"
        ? unknownCandidateSet()
        : resolveOriginCallable(state, { directThis: directThisOf(expression), origin }),
  });

export const resolveCanonicalValueCallableOrigins = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueExpressionOrigin> =>
  mapCandidateSet(resolveCallable(state, expression), {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (callable) => callable.target,
  });

const invocationFact = (
  callable: CanonicalValueCallableCandidate,
  segments: readonly CanonicalValueInvocationArgumentSegment[],
): CandidateSet<CanonicalValueInvocationFact> =>
  closedCandidateSet(
    [
      {
        argumentSegments: appendCanonicalValueInvocationSegments(
          callable.argumentSegments,
          segments,
        ),
        target: callable.target,
        thisArgument: callable.boundThis ?? callable.directThis,
      },
    ],
    canonicalValueInvocationFactKey,
  );

const invokeBase = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly base: CanonicalValueExpressionOrigin;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
    readonly thisArgument: ESTree.Expression | null;
  },
): CandidateSet<CanonicalValueInvocationFact> =>
  flatMapCandidateSet(resolveOriginCallable(state, { directThis: null, origin: input.base }), {
    candidateKey: canonicalValueInvocationFactKey,
    mapCandidate: (target) =>
      closedCandidateSet(
        [
          {
            argumentSegments: appendCanonicalValueInvocationSegments(
              target.argumentSegments,
              input.segments,
            ),
            target: target.target,
            thisArgument: target.boundThis ?? input.thisArgument,
          },
        ],
        canonicalValueInvocationFactKey,
      ),
  });

const invokeCallWrapper = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
  },
): CandidateSet<CanonicalValueInvocationFact> => {
  const base = popCanonicalValueInvocationProperty(input.callable.target, "call");
  const items = canonicalValueDirectInvocationArguments(
    appendCanonicalValueInvocationSegments(input.callable.argumentSegments, input.segments),
  );
  if (base === null || items === null || items[0]?.type === "SpreadElement") {
    return unknownCandidateSet();
  }
  return invokeBase(state, {
    base,
    segments: canonicalValueDirectInvocationSegments(items.slice(1)),
    thisArgument: canonicalValueArgumentExpression(items[0]),
  });
};

const isGlobalReflect = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  if (origin.projections.length !== 0 || origin.expression.type !== "Identifier") return false;
  if (origin.expression.name !== "Reflect") return false;
  const binding = state.bindingIndex.resolveIdentifier(origin.expression);
  return binding === null || state.bindingIndex.definitionsOf(binding).length === 0;
};

const invokeReflectApply = (
  state: CanonicalValueInvocationInternals,
  items: readonly ESTree.Argument[],
): CandidateSet<CanonicalValueInvocationFact> => {
  const target = canonicalValueArgumentExpression(items[0]);
  const thisArgument = canonicalValueArgumentExpression(items[1]);
  const argumentArray = canonicalValueArgumentExpression(items[2]);
  if (target === null || argumentArray === null) return unknownCandidateSet();
  return flatMapCandidateSet(resolveCallable(state, target), {
    candidateKey: canonicalValueInvocationFactKey,
    mapCandidate: (callable) =>
      closedCandidateSet(
        [
          {
            argumentSegments: appendCanonicalValueInvocationSegments(callable.argumentSegments, [
              { expression: argumentArray, kind: "array" },
            ]),
            target: callable.target,
            thisArgument: callable.boundThis ?? thisArgument,
          },
        ],
        canonicalValueInvocationFactKey,
      ),
  });
};

const invokeReflectConstruct = (
  state: CanonicalValueInvocationInternals,
  items: readonly ESTree.Argument[],
): CandidateSet<CanonicalValueInvocationFact> => {
  const target = canonicalValueArgumentExpression(items[0]);
  const argumentArray = canonicalValueArgumentExpression(items[1]);
  if (target === null || argumentArray === null) return unknownCandidateSet();
  return flatMapCandidateSet(resolveCallable(state, target), {
    candidateKey: canonicalValueInvocationFactKey,
    mapCandidate: (callable) =>
      invocationFact({ ...callable, boundThis: null, directThis: null }, [
        { expression: argumentArray, kind: "array" },
      ]),
  });
};

const invokeReflectConstructWrapper = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
  },
): CandidateSet<CanonicalValueInvocationFact> | null => {
  const base = popCanonicalValueInvocationProperty(input.callable.target, "construct");
  if (base === null || !isGlobalReflect(state, base)) return null;
  const items = canonicalValueDirectInvocationArguments(
    appendCanonicalValueInvocationSegments(input.callable.argumentSegments, input.segments),
  );
  return items === null ? unknownCandidateSet() : invokeReflectConstruct(state, items);
};

const invokeApplyWrapper = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
  },
): CandidateSet<CanonicalValueInvocationFact> => {
  const base = popCanonicalValueInvocationProperty(input.callable.target, "apply");
  const items = canonicalValueDirectInvocationArguments(
    appendCanonicalValueInvocationSegments(input.callable.argumentSegments, input.segments),
  );
  if (base === null || items === null) return unknownCandidateSet();
  if (isGlobalReflect(state, base)) return invokeReflectApply(state, items);
  const argumentArray = canonicalValueArgumentExpression(items[1]);
  if (argumentArray === null) return unknownCandidateSet();
  return invokeBase(state, {
    base,
    segments: [{ expression: argumentArray, kind: "array" }],
    thisArgument: canonicalValueArgumentExpression(items[0]),
  });
};

const invokeFunctionWrapper = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
  },
): CandidateSet<CanonicalValueInvocationFact> => {
  if (popCanonicalValueInvocationProperty(input.callable.target, "call") !== null) {
    return invokeCallWrapper(state, input);
  }
  if (popCanonicalValueInvocationProperty(input.callable.target, "apply") !== null) {
    return invokeApplyWrapper(state, input);
  }
  return popCanonicalValueInvocationProperty(input.callable.target, "bind") === null
    ? invocationFact(input.callable, input.segments)
    : absentCandidateSet();
};

const invokeCallable = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly callable: CanonicalValueCallableCandidate;
    readonly construct: boolean;
    readonly segments: readonly CanonicalValueInvocationArgumentSegment[];
  },
): CandidateSet<CanonicalValueInvocationFact> => {
  if (input.construct) {
    return invocationFact({ ...input.callable, boundThis: null, directThis: null }, input.segments);
  }
  const reflectedConstruction = invokeReflectConstructWrapper(state, input);
  if (reflectedConstruction !== null) return reflectedConstruction;
  if (
    input.callable.boundThis !== null &&
    (canonicalValueIsGlobalFunctionMethod(state, {
      method: "call",
      origin: input.callable.target,
    }) ||
      canonicalValueIsGlobalFunctionMethod(state, {
        method: "apply",
        origin: input.callable.target,
      }))
  ) {
    return invocationFact(input.callable, input.segments);
  }
  return invokeFunctionWrapper(state, input);
};

export const resolveCanonicalValueInvocationFacts = (
  state: CanonicalValueInvocationInternals,
  invocation: ESTree.CallExpression | ESTree.NewExpression,
): CandidateSet<CanonicalValueInvocationFact> =>
  flatMapCandidateSet(resolveCallable(state, invocation.callee), {
    candidateKey: canonicalValueInvocationFactKey,
    mapCandidate: (callable) =>
      flatMapCandidateSet(
        invokeCallable(state, {
          callable,
          construct: invocation.type === "NewExpression",
          segments: canonicalValueDirectInvocationSegments(invocation.arguments),
        }),
        {
          candidateKey: canonicalValueInvocationFactKey,
          mapCandidate: (fact) =>
            normalizeCanonicalValueNestedInvocationFact(
              {
                factKey: canonicalValueInvocationFactKey,
                resolveCallable: (expression) => resolveCallable(state, expression),
                resolveOriginCallable: (origin) =>
                  resolveOriginCallable(state, { directThis: null, origin }),
                state,
              },
              { fact, seen: new Set() },
            ),
        },
      ),
  });
