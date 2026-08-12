import { applyArrayMutationOperation } from "./canonical-value-array-mutation-state.ts";
import { groupBase } from "./canonical-value-collection-mutation-domain.ts";
import { reportCanonicalValueDomainCandidates } from "./canonical-value-domain-report.ts";
import { applySetMutationOperation } from "./canonical-value-set-mutation-state.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  CanonicalValueCollectionMutationSinkEnvironment,
  MutationGroup,
  MutationOperation,
  MutationState,
} from "./canonical-value-collection-mutation-types.ts";
import type { CanonicalValueDomainFact } from "./canonical-value-domain.ts";

const applyOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: MutationOperation;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => {
  const operation = input.operation;
  if (
    operation.kind === "set-add" ||
    operation.kind === "set-clear" ||
    operation.kind === "set-delete"
  ) {
    return applySetMutationOperation({ ...input, operation });
  }
  return applyArrayMutationOperation({ ...input, operation });
};

const reportableDomainFacts = (
  states: CandidateSet<MutationState>,
): CandidateSet<CanonicalValueDomainFact> => ({
  candidates: states.candidates.flatMap<CanonicalValueDomainFact>((state) => {
    if (state.kind === "unregistered") return [state];
    if (!state.mutationContribution) return [];
    const {
      baselineLocalContribution: _,
      baselineValues: __,
      mutationContribution: ___,
      reportSingleton: ____,
      ...fact
    } = state;
    return [
      state.catalogBindingContribution === true ? { ...fact, values: state.baselineValues } : fact,
    ];
  }),
  complete: states.complete,
});

const reportableSingletonFacts = (
  states: CandidateSet<MutationState>,
): CandidateSet<CanonicalValueDomainFact> => ({
  candidates: states.candidates.flatMap<CanonicalValueDomainFact>((state) => {
    if (state.kind === "unregistered" || !state.reportSingleton) return [];
    if (new Set(state.values).size !== 1) return [];
    const {
      baselineLocalContribution: _,
      baselineValues: __,
      mutationContribution: ___,
      reportSingleton: ____,
      ...fact
    } = state;
    return [{ ...fact, values: state.baselineValues }];
  }),
  complete: states.complete,
});

export const compareCanonicalValueMutationOrders = (
  left: readonly number[],
  right: readonly number[],
): number => {
  const length = Math.max(left.length, right.length);
  return (
    Array.from({ length }, (_, index) => (left[index] ?? -1) - (right[index] ?? -1)).find(
      (difference) => difference !== 0,
    ) ?? 0
  );
};

const compareOperationOrder = (left: MutationOperation, right: MutationOperation): number =>
  compareCanonicalValueMutationOrders(left.order, right.order);

export const reportMutationGroup = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  group: MutationGroup,
): void => {
  const states = group.operations
    .toSorted(compareOperationOrder)
    .reduce(
      (current, operation) =>
        applyOperation({ node: group.origin.expression, operation, states: current }),
      groupBase(environment, group),
    );
  reportCanonicalValueDomainCandidates({
    candidates: reportableDomainFacts(states),
    onlyWhenOwned: true,
    reportIncompleteValues: false,
    reporter: environment.reporter,
    supplemental: true,
  });
  reportCanonicalValueDomainCandidates({
    candidates: reportableSingletonFacts(states),
    onlyWhenOwned: true,
    reportDerivedSingletonValues: true,
    reportIncompleteValues: false,
    reporter: environment.reporter,
    supplemental: true,
  });
};
