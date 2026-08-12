import { uniqBy } from "es-toolkit";

import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  type CanonicalValue,
} from "../lib/canonical-values/fingerprint.ts";
import { mutationFactKey, mutationStateKey } from "./canonical-value-collection-mutation-domain.ts";

import type { ESTree } from "@oxlint/plugins";
import type { MutationFact, MutationState } from "./canonical-value-collection-mutation-types.ts";

export type MutationStateTransformation = {
  readonly destructive: boolean;
  readonly node: ESTree.Span;
  readonly reportSingleton?: boolean;
  readonly transform: (
    base: readonly CanonicalValue[],
    source: readonly CanonicalValue[],
  ) => readonly CanonicalValue[] | null;
};

export const distinctMutationValues = (
  values: readonly CanonicalValue[],
): readonly CanonicalValue[] => uniqBy(values, canonicalValueKey);

const changedVocabulary = (
  before: readonly CanonicalValue[],
  after: readonly CanonicalValue[],
): boolean => fingerprintValues(before) !== fingerprintValues(after);

const mutationContributes = (input: {
  readonly changed: boolean;
  readonly differsFromBaseline: boolean;
  readonly source: Extract<MutationFact, { readonly kind: "values" }>;
  readonly state: Extract<MutationState, { readonly kind: "values" }>;
  readonly transformation: MutationStateTransformation;
}): boolean =>
  input.differsFromBaseline &&
  (input.state.mutationContribution ||
    (input.changed && (input.transformation.destructive || input.source.localContribution)));

const reportsSingleton = (input: {
  readonly differsFromBaseline: boolean;
  readonly source: Extract<MutationFact, { readonly kind: "values" }>;
  readonly state: Extract<MutationState, { readonly kind: "values" }>;
  readonly transformation: MutationStateTransformation;
}): boolean =>
  input.state.reportSingleton ||
  (input.differsFromBaseline &&
    input.transformation.destructive &&
    (!input.source.localContribution || input.transformation.reportSingleton === true));

const transformedValueState = (input: {
  readonly source: Extract<MutationFact, { readonly kind: "values" }>;
  readonly state: Extract<MutationState, { readonly kind: "values" }>;
  readonly transformation: MutationStateTransformation;
}): CandidateSet<MutationState> => {
  const canonicalItems = input.transformation.transform(input.state.values, input.source.values);
  if (canonicalItems === null) return { candidates: [], complete: false };
  const changed = changedVocabulary(input.state.values, canonicalItems);
  const differsFromBaseline = changedVocabulary(input.state.baselineValues, canonicalItems);
  const mutationContribution = mutationContributes({
    ...input,
    changed,
    differsFromBaseline,
  });
  return closedCandidateSet(
    [
      {
        catalogBindingContribution:
          input.state.catalogBindingContribution === true ||
          input.source.catalogBindingContribution === true,
        baselineLocalContribution: input.state.baselineLocalContribution,
        baselineValues: input.state.baselineValues,
        derivedFromRegisteredRoute:
          input.state.derivedFromRegisteredRoute || input.source.derivedFromRegisteredRoute,
        kind: "values",
        localContribution: input.state.baselineLocalContribution || mutationContribution,
        mutationContribution,
        node: input.transformation.node,
        reportSingleton: reportsSingleton({ ...input, differsFromBaseline }),
        values: canonicalItems,
      },
    ],
    mutationStateKey,
  );
};

export const combineMutationStateWithSource = (input: {
  readonly source: MutationFact;
  readonly state: MutationState;
  readonly transformation: MutationStateTransformation;
}): CandidateSet<MutationState> => {
  if (input.state.kind === "unregistered") {
    return closedCandidateSet([input.state], mutationStateKey);
  }
  if (input.source.kind === "unregistered") {
    return closedCandidateSet([input.source], mutationStateKey);
  }
  return transformedValueState({
    source: input.source,
    state: input.state,
    transformation: input.transformation,
  });
};

export const applyMutationSource = (input: {
  readonly source: CandidateSet<MutationFact>;
  readonly states: CandidateSet<MutationState>;
  readonly transformation: MutationStateTransformation;
}): CandidateSet<MutationState> => {
  const resolved = flatMapCandidateSet(input.states, {
    candidateKey: mutationStateKey,
    mapCandidate: (state) =>
      flatMapCandidateSet(input.source, {
        candidateKey: mutationStateKey,
        mapCandidate: (source) => combineMutationStateWithSource({ ...input, source, state }),
      }),
  });
  if (input.source.complete) return resolved;
  const opaque = {
    candidates: input.states.candidates.map((state) =>
      state.kind === "unregistered"
        ? state
        : {
            ...state,
            localContribution: true,
            mutationContribution: true,
            node: input.transformation.node,
          },
    ),
    complete: false,
  } satisfies CandidateSet<MutationState>;
  return joinCandidateSets([resolved, opaque], mutationStateKey);
};

export const applyOptionalMutation = (input: {
  readonly after: CandidateSet<MutationState>;
  readonly before: CandidateSet<MutationState>;
  readonly definite: boolean;
}): CandidateSet<MutationState> =>
  input.definite ? input.after : joinCandidateSets([input.before, input.after], mutationStateKey);

export const applySourcelessMutation = (input: {
  readonly definite: boolean;
  readonly states: CandidateSet<MutationState>;
  readonly transformation: MutationStateTransformation;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: applyMutationSource({
      source: closedCandidateSet(
        [
          {
            derivedFromRegisteredRoute: false,
            kind: "values",
            localContribution: false,
            node: input.transformation.node,
            values: [],
          },
        ],
        mutationFactKey,
      ),
      states: input.states,
      transformation: input.transformation,
    }),
    before: input.states,
    definite: input.definite,
  });
