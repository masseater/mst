import { flatMapCandidateSet, type CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import { mutationStateKey } from "./canonical-value-collection-mutation-domain.ts";
import {
  applyOptionalMutation,
  applySourcelessMutation,
} from "./canonical-value-collection-mutation-transition.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  MutationOperation,
  MutationState,
} from "./canonical-value-collection-mutation-types.ts";

type ArrayDestructiveOperation = Extract<
  MutationOperation,
  { readonly kind: "array-index-delta" | "array-length-delta" }
>;

const applyArrayLengthDelta = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayDestructiveOperation, { readonly kind: "array-length-delta" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: flatMapCandidateSet(input.operation.deltas, {
      candidateKey: mutationStateKey,
      mapCandidate: (delta) =>
        applySourcelessMutation({
          definite: true,
          states: input.states,
          transformation: {
            destructive: delta < 0,
            node: input.node,
            transform: (base) => {
              const length = base.length + delta;
              return Number.isInteger(length) && length >= 0 && length <= 4_294_967_295
                ? base.slice(0, length)
                : null;
            },
          },
        }),
    }),
    before: input.states,
    definite: input.operation.definite,
  });

const indexDeltaCandidates = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayDestructiveOperation, { readonly kind: "array-index-delta" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  flatMapCandidateSet(input.operation.indexes, {
    candidateKey: mutationStateKey,
    mapCandidate: (index) =>
      flatMapCandidateSet(input.operation.deltas, {
        candidateKey: mutationStateKey,
        mapCandidate: (delta) =>
          applySourcelessMutation({
            definite: true,
            states: input.states,
            transformation: {
              destructive: true,
              node: input.node,
              transform: (base) => {
                const canonicalItem = base[index];
                return typeof canonicalItem === "number"
                  ? base.with(index, canonicalItem + delta)
                  : null;
              },
            },
          }),
      }),
  });

const applyArrayIndexDelta = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayDestructiveOperation, { readonly kind: "array-index-delta" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: indexDeltaCandidates(input),
    before: input.states,
    definite: input.operation.definite,
  });

export const applyArrayDestructiveOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: ArrayDestructiveOperation;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  input.operation.kind === "array-index-delta"
    ? applyArrayIndexDelta({ ...input, operation: input.operation })
    : applyArrayLengthDelta({ ...input, operation: input.operation });
