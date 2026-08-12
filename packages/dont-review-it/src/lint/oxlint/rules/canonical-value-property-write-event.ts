import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  propertyPathIsPrefixOf,
  propertyPathKey,
  type PropertyPath,
} from "../lib/canonical-values/property-path.ts";
import {
  canonicalValueAliasAddressKey,
  type CanonicalValueAliasedAddress,
} from "./canonical-value-alias-address.ts";
import { canonicalValueWriteSuppliesValue } from "./canonical-value-binding-types.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  applyCanonicalValueStateEvents,
  canonicalValueAbsentOriginSet,
  canonicalValueExpressionOriginSet,
  canonicalValueQueryIsInIteration,
  canonicalValueWriteExecution,
  canonicalValueWriteOccurrences,
  memoizedCanonicalValueOrigins,
  type CanonicalValueBindingResolutionInput,
  type CanonicalValuePropertyInternalQuery,
  type CanonicalValuePropertyInternals,
  type CanonicalValueStateEvent,
  type CanonicalValueWriteResolutionInput,
} from "./canonical-value-property-runtime.ts";

import type { Definition } from "@oxlint/plugins";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueIndexedPropertyPath,
  CanonicalValueMemberWrite,
  CanonicalValueWriteOccurrence,
} from "./canonical-value-binding-index.ts";
import type { CanonicalValueGuardExecution } from "./canonical-value-property-static.ts";

export type CanonicalValueWriteSourceResolver = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueWriteResolutionInput,
) => CandidateSet<CanonicalValueOrigin>;

const staticIndexedPaths = (
  state: CanonicalValuePropertyInternals,
  input: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValuePropertyInternalQuery["executionContext"];
    readonly indexedPath: CanonicalValueIndexedPropertyPath;
  },
): CandidateSet<PropertyPath> =>
  input.indexedPath.reduce<CandidateSet<PropertyPath>>(
    (paths, segment) =>
      flatMapCandidateSet(paths, {
        candidateKey: propertyPathKey,
        mapCandidate: (path) =>
          flatMapCandidateSet(
            state.staticResolver.propertyKeys(segment, {
              cutoff: input.cutoff,
              executionContext: input.executionContext,
            }),
            {
              candidateKey: propertyPathKey,
              mapCandidate: (key) => closedCandidateSet([[...path, key]], propertyPathKey),
            },
          ),
      }),
    closedCandidateSet([[]], propertyPathKey),
  );

const bindingWriteOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
    readonly write: CanonicalValueBindingWrite;
  },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.write.operator === "delete") return canonicalValueAbsentOriginSet();
  if (!canonicalValueWriteSuppliesValue(input.write)) return unknownCandidateSet();
  return input.resolveSourcePath(state, {
    ...input.write,
    cutoff: input.write.sourceContext.cutoff,
    executionContext: input.write.sourceContext.executionContext,
    prefix: [],
    resolve: input.resolve,
    targetPath: input.path,
  });
};

const bindingWriteInvalidatesPrevious = (input: {
  readonly occurrence: CanonicalValueWriteOccurrence;
  readonly sameExecutionContext: boolean;
  readonly write: CanonicalValueBindingWrite;
}): boolean =>
  input.write.operator === "parameter" ||
  (input.sameExecutionContext && !canonicalValueWriteSuppliesValue(input.write)) ||
  (input.occurrence.kind === "parent-context" && input.write.operator === "declaration");

const bindingWriteEvent = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly occurrence: CanonicalValueWriteOccurrence;
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
    readonly write: CanonicalValueBindingWrite;
  },
): CanonicalValueStateEvent | null => {
  const execution = canonicalValueWriteExecution(state, input.write);
  if (execution.definite && !execution.executes) return null;
  const sameExecutionContext = input.occurrence.kind === "same-context";
  return {
    definite:
      sameExecutionContext &&
      input.write.operator !== "parameter-default" &&
      execution.executes &&
      (execution.definite || canonicalValueQueryIsInIteration(input.write, input)),
    invalidatesPrevious: bindingWriteInvalidatesPrevious({
      occurrence: input.occurrence,
      sameExecutionContext,
      write: input.write,
    }),
    resolve: () => bindingWriteOrigins(state, input),
    start: input.occurrence.start,
  };
};

const memberWriteOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly matching: readonly PropertyPath[];
    readonly paths: CandidateSet<PropertyPath>;
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
    readonly write: CanonicalValueMemberWrite;
  },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.write.operator === "delete") return canonicalValueAbsentOriginSet();
  if (!canonicalValueWriteSuppliesValue(input.write)) return unknownCandidateSet();
  const origins = joinCandidateSets(
    input.matching.map((path) =>
      input.resolveSourcePath(state, {
        ...input.write,
        cutoff: input.write.sourceContext.cutoff,
        executionContext: input.write.sourceContext.executionContext,
        prefix: [],
        resolve: input.resolve,
        targetPath: input.path.slice(path.length),
      }),
    ),
    canonicalValueOriginKey,
  );
  return input.paths.complete ? origins : { ...origins, complete: false };
};

const memberEventIsDefinite = (input: {
  readonly descendant: boolean;
  readonly execution: CanonicalValueGuardExecution;
  readonly matchingCount: number;
  readonly pathCount: number;
  readonly pathsComplete: boolean;
  readonly sameExecutionContext: boolean;
}): boolean =>
  !input.descendant &&
  input.sameExecutionContext &&
  input.execution.definite &&
  input.execution.executes &&
  input.pathsComplete &&
  input.matchingCount === input.pathCount;

const memberWriteEvent = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly occurrence: CanonicalValueWriteOccurrence;
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
    readonly write: CanonicalValueMemberWrite;
  },
): CanonicalValueStateEvent | null => {
  const execution = canonicalValueWriteExecution(state, input.write);
  if (execution.definite && !execution.executes) return null;
  const paths = staticIndexedPaths(state, {
    cutoff: input.write.start,
    executionContext: input.write.executionContext,
    indexedPath: input.write.targetPath,
  });
  const matching = paths.candidates.filter((path) => propertyPathIsPrefixOf(path, input.path));
  const descendant = paths.candidates.some(
    (path) => path.length > input.path.length && propertyPathIsPrefixOf(input.path, path),
  );
  if (matching.length === 0 && !descendant && paths.complete) return null;
  const iterationExecution = canonicalValueQueryIsInIteration(input.write, input)
    ? { definite: true, executes: true }
    : execution;
  const definite = memberEventIsDefinite({
    descendant,
    execution: iterationExecution,
    matchingCount: matching.length,
    pathCount: paths.candidates.length,
    pathsComplete: paths.complete,
    sameExecutionContext: input.occurrence.kind === "same-context",
  });
  return {
    definite,
    invalidatesPrevious:
      input.occurrence.kind === "same-context" &&
      (descendant || !canonicalValueWriteSuppliesValue(input.write) || !paths.complete),
    resolve: () =>
      descendant ? unknownCandidateSet() : memberWriteOrigins(state, { ...input, matching, paths }),
    start: input.occurrence.start,
  };
};

const opaqueBindingDefinition = (definition: Definition): boolean =>
  definition.node.type === "ImportDefaultSpecifier" ||
  definition.node.type === "ImportNamespaceSpecifier" ||
  definition.node.type === "ImportSpecifier" ||
  definition.node.type === "FunctionDeclaration" ||
  definition.node.type === "ClassDeclaration" ||
  definition.node.type === "TSImportEqualsDeclaration";

const bindingFallback = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput,
): CandidateSet<CanonicalValueOrigin> =>
  state.bindingIndex.definitionsOf(input.binding).some(opaqueBindingDefinition)
    ? canonicalValueExpressionOriginSet(input.expression, input.path)
    : unknownCandidateSet();

const bindingEvents = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
  },
): readonly CanonicalValueStateEvent[] =>
  state.bindingIndex.bindingWritesOf(input.binding).flatMap((write) => {
    const occurrences = canonicalValueWriteOccurrences(state, { query: input, write });
    return occurrences.flatMap((occurrence) => {
      const event = bindingWriteEvent(state, { ...input, occurrence, write });
      return event === null ? [] : [event];
    });
  });

const memberEvents = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
  },
): readonly CanonicalValueStateEvent[] =>
  state.bindingIndex.memberWritesOf(input.binding).flatMap((write) => {
    const occurrences = canonicalValueWriteOccurrences(state, { query: input, write });
    return occurrences.flatMap((occurrence) => {
      const event = memberWriteEvent(state, { ...input, occurrence, write });
      return event === null ? [] : [event];
    });
  });

const aliasEvent = (
  event: CanonicalValueStateEvent,
  address: CanonicalValueAliasedAddress,
): CanonicalValueStateEvent =>
  address.definite ? event : { ...event, definite: false, invalidatesPrevious: false };

const aliasedMemberState = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
  },
): { readonly complete: boolean; readonly events: readonly CanonicalValueStateEvent[] } => {
  const addresses = state.aliasIndex.addresses(state, input);
  const memberStates = addresses.candidates.map((address) => ({
    address,
    events: memberEvents(state, {
      ...input,
      binding: address.binding,
      path: address.path,
    }).map((event) => aliasEvent(event, address)),
  }));
  return {
    complete:
      addresses.complete ||
      memberStates.every((memberState) =>
        memberState.address.definite ? true : memberState.events.length === 0,
      ),
    events: memberStates.flatMap((memberState) => memberState.events),
  };
};

const bindingStateOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const aliased = aliasedMemberState(state, input);
  const origins = applyCanonicalValueStateEvents(
    [...bindingEvents(state, input), ...aliased.events],
    () => bindingFallback(state, input),
  );
  return aliased.complete ? origins : { ...origins, complete: false };
};

export const resolveCanonicalValueBindingWriteOrigin = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueBindingResolutionInput & {
    readonly resolveSourcePath: CanonicalValueWriteSourceResolver;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const context = input.executionContext.node;
  const key = `${canonicalValueAliasAddressKey({ binding: input.binding, path: [] })}:${input.cutoff}:${context.type}:${context.start}:${context.end}`;
  if (state.activeBindingQueries.has(key)) return unknownCandidateSet();
  state.activeBindingQueries.add(key);
  try {
    return memoizedCanonicalValueOrigins({
      compute: () => bindingStateOrigins(state, input),
      domain: true,
      identity: input.binding,
      query: input,
      state,
    });
  } finally {
    state.activeBindingQueries.delete(key);
  }
};
