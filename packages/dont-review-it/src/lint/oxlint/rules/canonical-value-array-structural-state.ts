import { flatMapCandidateSet, type CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import { mutationStateKey } from "./canonical-value-collection-mutation-domain.ts";
import {
  applyOptionalMutation,
  applySourcelessMutation,
  type MutationStateTransformation,
} from "./canonical-value-collection-mutation-transition.ts";
import { canonicalValueIntegerOrInfinity } from "./canonical-value-number-conversion.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  MutationOperation,
  MutationState,
} from "./canonical-value-collection-mutation-types.ts";

type ArrayStructuralOperation = Extract<
  MutationOperation,
  {
    readonly kind:
      | "array-clear"
      | "array-copy-within"
      | "array-delete"
      | "array-remove"
      | "array-truncate";
  }
>;

export const relativeArrayIndex = (length: number, value: number): number => {
  const integer = canonicalValueIntegerOrInfinity(value);
  if (integer === -Infinity) return 0;
  if (integer < 0) return Math.max(length + integer, 0);
  return Math.min(integer, length);
};

const applyArrayRemove = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-remove" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applySourcelessMutation({
    definite: input.operation.definite,
    states: input.states,
    transformation: {
      destructive: true,
      node: input.node,
      transform: (base) => (input.operation.method === "pop" ? base.slice(0, -1) : base.slice(1)),
    },
  });

const applyArrayClear = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-clear" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applySourcelessMutation({
    definite: input.operation.definite,
    states: input.states,
    transformation: { destructive: true, node: input.node, transform: () => [] },
  });

const candidateSourcelessMutation = (input: {
  readonly candidates: CandidateSet<number>;
  readonly definite: boolean;
  readonly states: CandidateSet<MutationState>;
  readonly transformation: (candidate: number) => MutationStateTransformation;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: flatMapCandidateSet(input.candidates, {
      candidateKey: mutationStateKey,
      mapCandidate: (candidate) =>
        applySourcelessMutation({
          definite: true,
          states: input.states,
          transformation: input.transformation(candidate),
        }),
    }),
    before: input.states,
    definite: input.definite,
  });

const applyArrayTruncate = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-truncate" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  candidateSourcelessMutation({
    candidates: input.operation.lengths,
    definite: input.operation.definite,
    states: input.states,
    transformation: (length) => ({
      destructive: true,
      node: input.node,
      transform: (base) => base.slice(0, length),
    }),
  });

const applyArrayDelete = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-delete" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  candidateSourcelessMutation({
    candidates: input.operation.indexes,
    definite: input.operation.definite,
    states: input.states,
    transformation: (index) => ({
      destructive: true,
      node: input.node,
      transform: (base) => base.filter((_, candidateIndex) => candidateIndex !== index),
    }),
  });

const copyWithinTransformation = (input: {
  readonly end: number | null;
  readonly node: ESTree.Span;
  readonly start: number;
  readonly target: number;
}): MutationStateTransformation => ({
  destructive: true,
  node: input.node,
  transform: (base) => {
    const target = relativeArrayIndex(base.length, input.target);
    const start = relativeArrayIndex(base.length, input.start);
    const end = input.end === null ? base.length : relativeArrayIndex(base.length, input.end);
    const count = Math.min(Math.max(end - start, 0), base.length - target);
    const copied = base.slice(start, start + count);
    return base.map((value, index) => {
      const copiedIndex = index - target;
      return copiedIndex >= 0 && copiedIndex < copied.length
        ? (copied[copiedIndex] ?? value)
        : value;
    });
  },
});

const copyWithinCandidates = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-copy-within" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  flatMapCandidateSet(input.operation.targets, {
    candidateKey: mutationStateKey,
    mapCandidate: (target) =>
      flatMapCandidateSet(input.operation.starts, {
        candidateKey: mutationStateKey,
        mapCandidate: (start) =>
          flatMapCandidateSet(input.operation.ends, {
            candidateKey: mutationStateKey,
            mapCandidate: (end) =>
              applySourcelessMutation({
                definite: true,
                states: input.states,
                transformation: copyWithinTransformation({
                  end,
                  node: input.node,
                  start,
                  target,
                }),
              }),
          }),
      }),
  });

const applyCopyWithin = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayStructuralOperation, { readonly kind: "array-copy-within" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: copyWithinCandidates(input),
    before: input.states,
    definite: input.operation.definite,
  });

export const applyArrayStructuralOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: ArrayStructuralOperation;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => {
  const operation = input.operation;
  if (operation.kind === "array-clear") return applyArrayClear({ ...input, operation });
  if (operation.kind === "array-copy-within") return applyCopyWithin({ ...input, operation });
  if (operation.kind === "array-delete") return applyArrayDelete({ ...input, operation });
  if (operation.kind === "array-remove") return applyArrayRemove({ ...input, operation });
  return applyArrayTruncate({ ...input, operation });
};
