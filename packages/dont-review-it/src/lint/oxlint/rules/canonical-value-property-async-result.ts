import {
  closedCandidateSet,
  joinCandidateSets,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueYieldCallArgumentSegments } from "./canonical-value-binding-call-segments.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  appendCanonicalValueProjection,
  type CanonicalValuePropertyInternals,
  type CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueYieldResult } from "./canonical-value-binding-types.ts";

type StandardResultArgument = {
  readonly consumesIterable: boolean;
  readonly expression: ESTree.Expression;
};

const firstArgument = (call: ESTree.CallExpression): ESTree.Expression | null =>
  canonicalValueArgumentExpression(call.arguments[0]);

type AsyncResultInput = CanonicalValueResolvedPropertyQuery;

const isGlobalIdentifier = (input: {
  readonly expression: ESTree.Expression;
  readonly name: string;
  readonly state: CanonicalValuePropertyInternals;
}): boolean =>
  input.expression.type === "Identifier" &&
  input.expression.name === input.name &&
  (input.state.bindingIndex.resolveIdentifier(input.expression)?.defs.length ?? 0) === 0;

const isGlobalObject = (input: {
  readonly expression: ESTree.Expression;
  readonly name: string;
  readonly state: CanonicalValuePropertyInternals;
}): boolean => {
  const current = unwrapExpression(input.expression);
  if (isGlobalIdentifier({ ...input, expression: current })) return true;
  if (current.type !== "MemberExpression" || current.object.type === "Super") return false;
  return (
    canonicalValueStaticMemberName(current) === input.name &&
    isGlobalIdentifier({ expression: current.object, name: "globalThis", state: input.state })
  );
};

type StandardResultInput = {
  readonly call: ESTree.CallExpression;
  readonly name: string | null;
  readonly object: ESTree.Expression;
  readonly state: CanonicalValuePropertyInternals;
};

const standardPromiseArgument = (input: StandardResultInput): StandardResultArgument | null => {
  const supported =
    isGlobalObject({ expression: input.object, name: "Promise", state: input.state }) &&
    (input.name === "all" || input.name === "resolve");
  const expression = supported ? firstArgument(input.call) : null;
  return expression === null ? null : { consumesIterable: false, expression };
};

const standardArrayArgument = (input: StandardResultInput): StandardResultArgument | null => {
  const supported =
    isGlobalObject({ expression: input.object, name: "Array", state: input.state }) &&
    (input.name === "from" || input.name === "fromAsync") &&
    input.call.arguments.length < 2;
  const expression = supported ? firstArgument(input.call) : null;
  return expression === null ? null : { consumesIterable: true, expression };
};

const standardResultArgument = (
  state: CanonicalValuePropertyInternals,
  call: ESTree.CallExpression,
): StandardResultArgument | null => {
  const callee = unwrapExpression(call.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  const input = {
    call,
    name: canonicalValueStaticMemberName(callee),
    object: callee.object,
    state,
  };
  return standardPromiseArgument(input) ?? standardArrayArgument(input);
};

const resolveAtSource = (source: {
  readonly expression: ESTree.Expression;
  readonly input: AsyncResultInput;
  readonly state: CanonicalValuePropertyInternals;
}): CandidateSet<CanonicalValueOrigin> =>
  source.input.resolve(source.state, {
    ...source.input,
    cutoff: source.expression.start,
    executionContext: source.state.bindingIndex.executionContextAt(source.expression),
    expression: source.expression,
  });

const generatorOrigins = (
  input: AsyncResultInput & {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
    readonly yields: readonly CanonicalValueYieldResult[];
  },
): CandidateSet<CanonicalValueOrigin> => {
  const base = canonicalValueExpressionOrigin(input.expression, [
    {
      kind: "call-arguments",
      segments: canonicalValueYieldCallArgumentSegments(input.yields),
      startIndex: 0,
    },
  ]);
  const origin =
    input.path.length === 0
      ? base
      : {
          ...base,
          projections: [...base.projections, { kind: "property" as const, path: input.path }],
        };
  return closedCandidateSet([origin], canonicalValueOriginKey);
};

const localInvocationOrigins = (
  state: CanonicalValuePropertyInternals,
  input: AsyncResultInput & {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const returns = state.bindingIndex.callReturnResults(input.expression);
  const yields = state.bindingIndex.callYieldResults(input.expression);
  if (returns.length === 0 && yields.length === 0) return null;
  const returnOrigins = returns.map((result) =>
    resolveAtSource({ expression: result, input, state }),
  );
  const yieldOrigins =
    yields.length === 0
      ? []
      : [generatorOrigins({ ...input, expression: input.expression, yields })];
  return joinCandidateSets([...returnOrigins, ...yieldOrigins], canonicalValueOriginKey);
};

const iteratorNextOrigins = (
  state: CanonicalValuePropertyInternals,
  input: AsyncResultInput & { readonly expression: ESTree.CallExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  const [first, ...remaining] = input.path;
  const callee = unwrapExpression(input.expression.callee);
  if (
    first !== "value" ||
    callee.type !== "MemberExpression" ||
    callee.object.type === "Super" ||
    canonicalValueStaticMemberName(callee) !== "next"
  ) {
    return null;
  }
  const iteratorOrigins = input.resolve(state, {
    ...input,
    expression: callee.object,
    path: [],
  });
  const yieldedOrigins = iteratorOrigins.candidates.flatMap((origin) => {
    if (
      origin.kind === "absent" ||
      (origin.expression.type !== "CallExpression" && origin.expression.type !== "NewExpression")
    ) {
      return [];
    }
    return state.bindingIndex.callYieldResults(origin.expression).map((result) =>
      resolveAtSource({
        expression: result.expression,
        input: { ...input, path: remaining },
        state,
      }),
    );
  });
  if (yieldedOrigins.length === 0) return null;
  const origins = joinCandidateSets(yieldedOrigins, canonicalValueOriginKey);
  return iteratorOrigins.complete ? origins : { ...origins, complete: false };
};

const invocationOrigins = (
  state: CanonicalValuePropertyInternals,
  input: AsyncResultInput & {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.expression.type === "CallExpression") {
    const next = iteratorNextOrigins(state, { ...input, expression: input.expression });
    if (next !== null) return next;
    const argument = standardResultArgument(state, input.expression);
    if (argument !== null) {
      const origins = resolveAtSource({ expression: argument.expression, input, state });
      return argument.consumesIterable
        ? appendCanonicalValueProjection(origins, { kind: "array-element" })
        : origins;
    }
  }
  return localInvocationOrigins(state, input);
};

export const canonicalValueAsyncResultOrigins = (
  state: CanonicalValuePropertyInternals,
  input: AsyncResultInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  const expression = input.expression;
  if (expression.type === "AwaitExpression") {
    return resolveAtSource({ expression: expression.argument, input, state });
  }
  if (expression.type !== "CallExpression" && expression.type !== "NewExpression") return null;
  return invocationOrigins(state, { ...input, expression });
};
