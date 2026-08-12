import { flatMapCandidateSet, type CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import { applyArrayDestructiveOperation } from "./canonical-value-array-destructive-state.ts";
import {
  applyArrayStructuralOperation,
  relativeArrayIndex,
} from "./canonical-value-array-structural-state.ts";
import { mutationStateKey } from "./canonical-value-collection-mutation-domain.ts";
import {
  applyMutationSource,
  applyOptionalMutation,
  combineMutationStateWithSource,
  type MutationStateTransformation,
} from "./canonical-value-collection-mutation-transition.ts";
import { canonicalValueIntegerOrInfinity } from "./canonical-value-number-conversion.ts";
import { canonicalValueStaticPrimitiveIsTruthy } from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  MutationOperation,
  MutationState,
} from "./canonical-value-collection-mutation-types.ts";

type ArrayMutationOperation = Extract<
  MutationOperation,
  {
    readonly kind:
      | "array-clear"
      | "array-copy-within"
      | "array-delete"
      | "array-fill"
      | "array-index"
      | "array-index-delta"
      | "array-insert"
      | "array-length-delta"
      | "array-logical-index"
      | "array-opaque"
      | "array-remove"
      | "array-splice"
      | "array-truncate";
  }
>;

const applyArrayInsert = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-insert" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: applyMutationSource({
      source: input.operation.source,
      states: input.states,
      transformation: {
        destructive: false,
        node: input.node,
        transform: (base, added) =>
          input.operation.method === "push" ? [...base, ...added] : [...added, ...base],
      },
    }),
    before: input.states,
    definite: input.operation.definite,
  });

const spliceTransformation = (input: {
  readonly deleteCount: number | null;
  readonly node: ESTree.Span;
  readonly start: number;
}): MutationStateTransformation => ({
  destructive: true,
  node: input.node,
  transform: (base, added) => {
    const start = relativeArrayIndex(base.length, input.start);
    const deleteCount =
      input.deleteCount === null
        ? base.length - start
        : Math.min(
            Math.max(canonicalValueIntegerOrInfinity(input.deleteCount), 0),
            base.length - start,
          );
    return [...base.slice(0, start), ...added, ...base.slice(start + deleteCount)];
  },
});

const spliceCandidates = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-splice" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  flatMapCandidateSet(input.states, {
    candidateKey: mutationStateKey,
    mapCandidate: (state) =>
      flatMapCandidateSet(input.operation.starts, {
        candidateKey: mutationStateKey,
        mapCandidate: (start) =>
          flatMapCandidateSet(input.operation.deleteCounts, {
            candidateKey: mutationStateKey,
            mapCandidate: (deleteCount) =>
              flatMapCandidateSet(input.operation.source, {
                candidateKey: mutationStateKey,
                mapCandidate: (source) =>
                  combineMutationStateWithSource({
                    source,
                    state,
                    transformation: spliceTransformation({
                      deleteCount,
                      node: input.node,
                      start,
                    }),
                  }),
              }),
          }),
      }),
  });

const applySplice = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-splice" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: spliceCandidates(input),
    before: input.states,
    definite: input.operation.definite,
  });

const fillTransformation = (input: {
  readonly end: number | null;
  readonly node: ESTree.Span;
  readonly start: number | null;
}): MutationStateTransformation => ({
  destructive: true,
  node: input.node,
  reportSingleton: input.start !== null || input.end !== null,
  transform: (base, replacement) => {
    const [onlyReplacement] = replacement;
    if (onlyReplacement === undefined || replacement.length !== 1) return null;
    const start = input.start === null ? 0 : relativeArrayIndex(base.length, input.start);
    const end = input.end === null ? base.length : relativeArrayIndex(base.length, input.end);
    return base.map((value, index) => (index >= start && index < end ? onlyReplacement : value));
  },
});

const fillCandidates = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-fill" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  flatMapCandidateSet(input.states, {
    candidateKey: mutationStateKey,
    mapCandidate: (state) =>
      flatMapCandidateSet(input.operation.starts, {
        candidateKey: mutationStateKey,
        mapCandidate: (start) =>
          flatMapCandidateSet(input.operation.ends, {
            candidateKey: mutationStateKey,
            mapCandidate: (end) =>
              flatMapCandidateSet(input.operation.source, {
                candidateKey: mutationStateKey,
                mapCandidate: (source) =>
                  combineMutationStateWithSource({
                    source,
                    state,
                    transformation: fillTransformation({ end, node: input.node, start }),
                  }),
              }),
          }),
      }),
  });

const applyFill = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-fill" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: fillCandidates(input),
    before: input.states,
    definite: input.operation.definite,
  });

const indexTransformation = (input: {
  readonly index: number;
  readonly node: ESTree.Span;
}): MutationStateTransformation => ({
  destructive: true,
  node: input.node,
  transform: (base, replacement) => {
    const [onlyReplacement] = replacement;
    if (onlyReplacement === undefined || replacement.length !== 1) {
      return null;
    }
    return input.index >= base.length
      ? [...base, onlyReplacement]
      : base.with(input.index, onlyReplacement);
  },
});

const applyArrayOpaque = (input: {
  readonly node: ESTree.Span;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => ({
  candidates: input.states.candidates.map((state) =>
    state.kind === "unregistered"
      ? state
      : {
          ...state,
          localContribution: true,
          mutationContribution: true,
          node: input.node,
        },
  ),
  complete: input.states.complete,
});

const indexCandidates = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-index" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  flatMapCandidateSet(input.states, {
    candidateKey: mutationStateKey,
    mapCandidate: (state) =>
      flatMapCandidateSet(input.operation.indexes, {
        candidateKey: mutationStateKey,
        mapCandidate: (index) =>
          flatMapCandidateSet(input.operation.source, {
            candidateKey: mutationStateKey,
            mapCandidate: (source) =>
              combineMutationStateWithSource({
                source,
                state,
                transformation: indexTransformation({ index, node: input.node }),
              }),
          }),
      }),
  });

const applyArrayIndex = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-index" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: indexCandidates(input),
    before: input.states,
    definite: input.operation.definite,
  });

const logicalIndexTransformation = (input: {
  readonly index: number;
  readonly node: ESTree.Span;
  readonly operator: "&&=" | "??=" | "||=";
}): MutationStateTransformation => ({
  destructive: true,
  node: input.node,
  transform: (base, replacement) => {
    const [onlyReplacement] = replacement;
    if (onlyReplacement === undefined || replacement.length !== 1) return null;
    const current = base[input.index];
    const replaces =
      input.operator === "&&="
        ? canonicalValueStaticPrimitiveIsTruthy(current)
        : input.operator === "||="
          ? !canonicalValueStaticPrimitiveIsTruthy(current)
          : current === null || current === undefined;
    if (!replaces) return base;
    return input.index >= base.length
      ? [...base, onlyReplacement]
      : base.with(input.index, onlyReplacement);
  },
});

const applyArrayLogicalIndex = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<ArrayMutationOperation, { readonly kind: "array-logical-index" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: flatMapCandidateSet(input.states, {
      candidateKey: mutationStateKey,
      mapCandidate: (state) =>
        flatMapCandidateSet(input.operation.indexes, {
          candidateKey: mutationStateKey,
          mapCandidate: (index) =>
            flatMapCandidateSet(input.operation.source, {
              candidateKey: mutationStateKey,
              mapCandidate: (source) =>
                combineMutationStateWithSource({
                  source,
                  state,
                  transformation: logicalIndexTransformation({
                    index,
                    node: input.node,
                    operator: input.operation.operator,
                  }),
                }),
            }),
        }),
    }),
    before: input.states,
    definite: input.operation.definite,
  });

const applyArrayValueOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<
    ArrayMutationOperation,
    {
      readonly kind:
        | "array-fill"
        | "array-index"
        | "array-insert"
        | "array-logical-index"
        | "array-splice";
    }
  >;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => {
  const operation = input.operation;
  if (operation.kind === "array-fill") return applyFill({ ...input, operation });
  if (operation.kind === "array-index") return applyArrayIndex({ ...input, operation });
  if (operation.kind === "array-logical-index") {
    return applyArrayLogicalIndex({ ...input, operation });
  }
  if (operation.kind === "array-insert") return applyArrayInsert({ ...input, operation });
  return applySplice({ ...input, operation });
};

export const applyArrayMutationOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: ArrayMutationOperation;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => {
  const operation = input.operation;
  if (operation.kind === "array-opaque") return applyArrayOpaque(input);
  if (operation.kind === "array-index-delta" || operation.kind === "array-length-delta") {
    return applyArrayDestructiveOperation({ ...input, operation });
  }
  if (
    operation.kind === "array-clear" ||
    operation.kind === "array-copy-within" ||
    operation.kind === "array-delete" ||
    operation.kind === "array-remove" ||
    operation.kind === "array-truncate"
  ) {
    return applyArrayStructuralOperation({ ...input, operation });
  }
  return applyArrayValueOperation({ ...input, operation });
};
