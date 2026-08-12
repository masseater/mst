import { maxBy, uniqBy } from "es-toolkit";

import {
  closedCandidateSet,
  joinCandidateSets,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  normalizePropertyPath,
  type PropertyPath,
  type PropertyPathInput,
} from "../lib/canonical-values/property-path.ts";
import { canonicalValueNodeContains } from "./canonical-value-binding-execution.ts";
import {
  appendCanonicalValueOriginProjection,
  CANONICAL_VALUE_ABSENT_ORIGIN,
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import type { CanonicalValueAliasIndex } from "./canonical-value-alias-index.ts";
import type {
  CanonicalValueBindingIndex,
  CanonicalValueExecutionContext,
  CanonicalValueGuard,
  CanonicalValueSourcePath,
  CanonicalValueWriteBase,
  CanonicalValueWriteOccurrence,
} from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation-types.ts";
import type {
  CanonicalValueGuardExecution,
  CanonicalValueStaticResolver,
} from "./canonical-value-property-static.ts";

export type CanonicalValuePropertyQuery = {
  readonly cutoff?: number;
  readonly executionContext?: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
  readonly path?: readonly PropertyPathInput[];
};

export type CanonicalValuePropertyInternalQuery = {
  readonly cutoff: number;
  readonly executionContext: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
  readonly path: PropertyPath;
};

export type CanonicalValuePropertyInternals = {
  readonly activeBindingQueries: Set<string>;
  readonly aliasIndex: CanonicalValueAliasIndex;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly invocationArgumentOrigins: CanonicalValueInvocationState["argumentOrigins"];
  readonly invocationFacts: (
    invocation: ESTree.CallExpression | ESTree.NewExpression,
  ) => CandidateSet<CanonicalValueInvocationFact>;
  readonly memo: CycleMemo<
    CandidateSet<CanonicalValueOrigin>,
    object,
    boolean,
    CanonicalValueExecutionContext
  >;
  readonly staticResolver: CanonicalValueStaticResolver;
};

export type CanonicalValueOriginResolver = (
  state: CanonicalValuePropertyInternals,
  query: CanonicalValuePropertyInternalQuery,
) => CandidateSet<CanonicalValueOrigin>;

export type CanonicalValueResolvedPropertyQuery = CanonicalValuePropertyInternalQuery & {
  readonly resolve: CanonicalValueOriginResolver;
};

export type CanonicalValueStateEvent = {
  readonly definite: boolean;
  readonly invalidatesPrevious: boolean;
  readonly resolve: () => CandidateSet<CanonicalValueOrigin>;
  readonly start: number;
};

export type CanonicalValueBindingResolutionInput = CanonicalValuePropertyInternalQuery & {
  readonly binding: Variable;
  readonly resolve: CanonicalValueOriginResolver;
};

export type CanonicalValueWriteResolutionInput = {
  readonly cutoff: number;
  readonly executionContext: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
  readonly prefix: PropertyPath;
  readonly resolve: CanonicalValueOriginResolver;
  readonly sourcePath: CanonicalValueSourcePath;
  readonly targetPath: PropertyPath;
};

export const canonicalValueQueryIsInIteration = (
  write: CanonicalValueWriteBase,
  query: CanonicalValuePropertyInternalQuery,
): boolean =>
  write.iteration !== null && canonicalValueNodeContains(write.iteration.body, query.expression);

export const canonicalValueAbsentOriginSet = (): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet([CANONICAL_VALUE_ABSENT_ORIGIN], canonicalValueOriginKey);

export const canonicalValueExpressionOriginSet = (
  expression: ESTree.Expression,
  path: PropertyPath = [],
): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet(
    [
      canonicalValueExpressionOrigin(
        expression,
        path.length === 0 ? [] : [{ kind: "property", path }],
      ),
    ],
    canonicalValueOriginKey,
  );

export const overlayCanonicalValueOriginSets = (
  later: CandidateSet<CanonicalValueOrigin>,
  earlier: () => CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueOrigin> => {
  const laterOrigins = later.candidates.filter((origin) => origin.kind !== "absent");
  const mayBeAbsent = later.candidates.some((origin) => origin.kind === "absent");
  const earlierSet = mayBeAbsent ? earlier() : null;
  return {
    candidates: uniqBy(
      [...laterOrigins, ...(earlierSet?.candidates ?? [])],
      canonicalValueOriginKey,
    ),
    complete: later.complete && (earlierSet?.complete ?? true),
  };
};

export const canonicalValueQueryWithDefaults = (
  bindingIndex: CanonicalValueBindingIndex,
  query: CanonicalValuePropertyQuery,
): CanonicalValuePropertyInternalQuery => ({
  cutoff: query.cutoff ?? query.expression.start,
  executionContext: query.executionContext ?? bindingIndex.executionContextAt(query.expression),
  expression: query.expression,
  path: normalizePropertyPath(query.path ?? []),
});

const guardExecutions = (
  state: CanonicalValuePropertyInternals,
  input: {
    readonly executionContext: CanonicalValueExecutionContext;
    readonly guards: readonly CanonicalValueGuard[];
  },
): readonly CanonicalValueGuardExecution[] =>
  input.guards.map((guard) => state.staticResolver.guardExecution(guard, input.executionContext));

const combinedGuardExecution = (
  executions: readonly CanonicalValueGuardExecution[],
): CanonicalValueGuardExecution => {
  if (executions.some((execution) => execution.definite && !execution.executes)) {
    return { definite: true, executes: false };
  }
  return {
    definite: executions.every((execution) => execution.definite && execution.executes),
    executes: true,
  };
};

export const canonicalValueNodeExecution = (
  state: CanonicalValuePropertyInternals,
  node: ESTree.Node,
): CanonicalValueGuardExecution => {
  const executionContext = state.bindingIndex.executionContextAt(node);
  return combinedGuardExecution(
    guardExecutions(state, {
      executionContext,
      guards: state.bindingIndex.guardsAt(node),
    }),
  );
};

export const canonicalValueWriteOccurrences = (
  state: CanonicalValuePropertyInternals,
  input: {
    readonly query: CanonicalValuePropertyInternalQuery;
    readonly write: CanonicalValueWriteBase;
  },
): readonly CanonicalValueWriteOccurrence[] =>
  state.bindingIndex.writeOccurrencesOf(input.write, input.query).filter((occurrence) =>
    occurrence.callSites.every((callSite) => {
      const execution = canonicalValueNodeExecution(state, callSite);
      return !execution.definite || execution.executes;
    }),
  );

export const canonicalValueWriteExecution = (
  state: CanonicalValuePropertyInternals,
  write: CanonicalValueWriteBase,
): CanonicalValueGuardExecution => {
  return combinedGuardExecution(
    guardExecutions(state, {
      executionContext: write.executionContext,
      guards: write.guards,
    }),
  );
};

export const memoizedCanonicalValueOrigins = ({
  compute,
  domain,
  identity,
  query,
  state,
}: {
  readonly compute: () => CandidateSet<CanonicalValueOrigin>;
  readonly domain: boolean;
  readonly identity: object;
  readonly query: CanonicalValuePropertyInternalQuery;
  readonly state: CanonicalValuePropertyInternals;
}): CandidateSet<CanonicalValueOrigin> => {
  const entry = state.memo.enter({ ...query, domain, identity });
  if (entry.kind === "cycle") return unknownCandidateSet();
  if (entry.kind === "cached") return entry.value;
  const origins = compute();
  entry.complete(origins);
  return origins;
};

export const applyCanonicalValueStateEvents = (
  events: readonly CanonicalValueStateEvent[],
  fallback: () => CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueOrigin> => {
  const boundary = maxBy(
    events.filter((event) => event.definite || event.invalidatesPrevious),
    (event) => event.start,
  );
  const selected =
    boundary === undefined ? events : events.filter((event) => event.start >= boundary.start);
  return joinCandidateSets(
    [...(boundary === undefined ? [fallback()] : []), ...selected.map((event) => event.resolve())],
    canonicalValueOriginKey,
  );
};

export const appendCanonicalValueProjection = (
  candidates: CandidateSet<CanonicalValueOrigin>,
  projection: CanonicalValueOriginProjection,
): CandidateSet<CanonicalValueOrigin> => ({
  candidates: candidates.candidates.map((origin) =>
    appendCanonicalValueOriginProjection(origin, projection),
  ),
  complete: candidates.complete,
});
