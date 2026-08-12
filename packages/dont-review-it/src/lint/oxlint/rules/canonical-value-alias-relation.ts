import { flatMap, maxBy } from "es-toolkit";

import {
  absentCandidateSet,
  closedCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { propertyPathIsPrefixOf } from "../lib/canonical-values/property-path.ts";
import {
  canonicalValueAliasAddressKey,
  canonicalValueAliasIndexedPaths,
  canonicalValueAliasSourcePathAddresses,
  type CanonicalValueAliasAddress,
  type CanonicalValueAliasRuntime,
} from "./canonical-value-alias-address.ts";
import { canonicalValueWriteSuppliesValue } from "./canonical-value-binding-types.ts";
import {
  canonicalValueQueryIsInIteration,
  canonicalValueWriteExecution,
  canonicalValueWriteOccurrences,
  type CanonicalValuePropertyInternalQuery,
} from "./canonical-value-property-runtime.ts";

import type { Variable } from "@oxlint/plugins";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueMemberWrite,
  CanonicalValueWriteOccurrence,
} from "./canonical-value-binding-index.ts";

export type CanonicalValueAliasRelation = {
  readonly definite: boolean;
  readonly sources: CandidateSet<CanonicalValueAliasAddress>;
  readonly target: CanonicalValueAliasAddress;
};

type CanonicalValueAliasEvent = {
  readonly guaranteed: boolean;
  readonly invalidatesPrevious: boolean;
  readonly sources: CandidateSet<CanonicalValueAliasAddress>;
  readonly start: number;
  readonly stateBoundary: boolean;
  readonly target: CanonicalValueAliasAddress;
};

const sameContextBoundary = (
  input: CanonicalValuePropertyInternalQuery & {
    readonly execution: ReturnType<typeof canonicalValueWriteExecution>;
    readonly occurrence: CanonicalValueWriteOccurrence;
    readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
  },
): boolean =>
  input.occurrence.kind === "same-context" &&
  input.write.operator !== "parameter-default" &&
  input.execution.executes &&
  (input.execution.definite || canonicalValueQueryIsInIteration(input.write, input));

const parentDeclaration = (input: {
  readonly occurrence: CanonicalValueWriteOccurrence;
  readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
}): boolean => input.occurrence.kind === "parent-context" && input.write.operator === "declaration";

const occurrenceEventState = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly occurrence: CanonicalValueWriteOccurrence;
    readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
  },
): Pick<
  CanonicalValueAliasEvent,
  "guaranteed" | "invalidatesPrevious" | "stateBoundary"
> | null => {
  const execution = canonicalValueWriteExecution(runtime.propertyState, input.write);
  if (execution.definite && !execution.executes) return null;
  const stateBoundary = sameContextBoundary({ ...input, execution });
  const outerDeclaration = parentDeclaration(input);
  return {
    guaranteed: stateBoundary || (outerDeclaration && execution.definite && execution.executes),
    invalidatesPrevious:
      input.write.operator === "parameter" ||
      (input.occurrence.kind === "same-context" &&
        !canonicalValueWriteSuppliesValue(input.write)) ||
      outerDeclaration,
    stateBoundary,
  };
};

const writeSources = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
  },
): CandidateSet<CanonicalValueAliasAddress> =>
  canonicalValueWriteSuppliesValue(input.write)
    ? canonicalValueAliasSourcePathAddresses(runtime, {
        ...input,
        cutoff: input.write.sourceContext.cutoff,
        executionContext: input.write.sourceContext.executionContext,
        expression: input.write.expression,
        sourcePath: input.write.sourcePath,
      })
    : absentCandidateSet();

const adjustedSources = (
  sources: CandidateSet<CanonicalValueAliasAddress>,
  targets: CandidateSet<CanonicalValueAliasAddress>,
): CandidateSet<CanonicalValueAliasAddress> =>
  targets.complete ? sources : openCandidateSet(sources.candidates, canonicalValueAliasAddressKey);

const writeOccurrenceEvents = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly occurrence: CanonicalValueWriteOccurrence;
    readonly sources: CandidateSet<CanonicalValueAliasAddress>;
    readonly target: CandidateSet<CanonicalValueAliasAddress>;
    readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
  },
): readonly CanonicalValueAliasEvent[] => {
  const eventState = occurrenceEventState(runtime, input);
  if (eventState === null) return [];
  const exactTarget = input.target.complete && input.target.candidates.length === 1;
  return input.target.candidates.map((target) => ({
    ...eventState,
    guaranteed: eventState.guaranteed && exactTarget,
    invalidatesPrevious: eventState.invalidatesPrevious && exactTarget,
    sources: input.sources,
    start: input.occurrence.start,
    stateBoundary: eventState.stateBoundary && exactTarget,
    target,
  }));
};

const writeEvents = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly target: CandidateSet<CanonicalValueAliasAddress>;
    readonly write: CanonicalValueBindingWrite | CanonicalValueMemberWrite;
  },
): readonly CanonicalValueAliasEvent[] => {
  const sources = adjustedSources(writeSources(runtime, input), input.target);
  const occurrences = canonicalValueWriteOccurrences(runtime.propertyState, {
    query: input,
    write: input.write,
  });
  return flatMap(occurrences, (occurrence) =>
    writeOccurrenceEvents(runtime, { ...input, occurrence, sources }),
  );
};

const bindingEvents = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly binding: Variable },
): readonly CanonicalValueAliasEvent[] =>
  flatMap(runtime.bindingIndex.bindingWritesOf(input.binding), (write) =>
    writeEvents(runtime, {
      ...input,
      target: closedCandidateSet(
        [{ binding: input.binding, path: [] }],
        canonicalValueAliasAddressKey,
      ),
      write,
    }),
  );

const aliasBoundary = (
  events: readonly CanonicalValueAliasEvent[],
): CanonicalValueAliasEvent | undefined =>
  maxBy(
    events.filter((event) => event.stateBoundary || event.invalidatesPrevious),
    (event) => event.start,
  );

const memberEvents = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly binding: Variable },
): readonly CanonicalValueAliasEvent[] => {
  const rawEvents = flatMap(runtime.bindingIndex.memberWritesOf(input.binding), (write) => {
    const paths = canonicalValueAliasIndexedPaths(runtime, {
      indexedPath: write.targetPath,
      query: {
        ...input,
        cutoff: write.start,
        executionContext: write.executionContext,
      },
    });
    return writeEvents(runtime, {
      ...input,
      target: {
        candidates: paths.candidates.map((path) => ({ binding: input.binding, path })),
        complete: paths.complete,
      },
      write,
    });
  });
  const boundaries = [...bindingEvents(runtime, input), ...rawEvents].filter(
    (event) => event.stateBoundary || event.invalidatesPrevious,
  );
  return rawEvents.filter((event) => {
    const boundary = maxBy(
      boundaries.filter(
        (candidate) =>
          candidate.target.binding === event.target.binding &&
          propertyPathIsPrefixOf(candidate.target.path, event.target.path),
      ),
      (candidate) => candidate.start,
    );
    return boundary === undefined || event.start >= boundary.start;
  });
};

const selectAliasEvents = (
  events: readonly CanonicalValueAliasEvent[],
): readonly CanonicalValueAliasEvent[] => {
  const boundary = aliasBoundary(events);
  return boundary === undefined ? events : events.filter((event) => event.start >= boundary.start);
};

const relationsForEventGroup = (
  events: readonly CanonicalValueAliasEvent[],
): readonly CanonicalValueAliasRelation[] => {
  const selected = selectAliasEvents(events);
  return selected.map((event) => ({
    definite:
      selected.length === 1 &&
      event.guaranteed &&
      event.sources.complete &&
      event.sources.candidates.length === 1,
    sources: event.sources,
    target: event.target,
  }));
};

export const canonicalValueActiveAliasRelations = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly binding: Variable },
): readonly CanonicalValueAliasRelation[] => {
  const events = flatMap(runtime.bindingIndex.allBindings(), (binding) => [
    ...bindingEvents(runtime, { ...input, binding }),
    ...memberEvents(runtime, { ...input, binding }),
  ]);
  const grouped = Map.groupBy(events, (event) => canonicalValueAliasAddressKey(event.target));
  return flatMap([...grouped.values()], relationsForEventGroup);
};
