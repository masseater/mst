import { canonicalValueKey } from "../lib/canonical-values/fingerprint.ts";
import {
  applyMutationSource,
  applyOptionalMutation,
  applySourcelessMutation,
  distinctMutationValues,
} from "./canonical-value-collection-mutation-transition.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  MutationOperation,
  MutationState,
} from "./canonical-value-collection-mutation-types.ts";

type SetMutationOperation = Extract<
  MutationOperation,
  { readonly kind: "set-add" | "set-clear" | "set-delete" }
>;

const applySetAdd = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<SetMutationOperation, { readonly kind: "set-add" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: applyMutationSource({
      source: input.operation.source,
      states: input.states,
      transformation: {
        destructive: false,
        node: input.node,
        transform: (base, added) => distinctMutationValues([...base, ...added]),
      },
    }),
    before: input.states,
    definite: input.operation.definite,
  });

const applySetDelete = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<SetMutationOperation, { readonly kind: "set-delete" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applyOptionalMutation({
    after: applyMutationSource({
      source: input.operation.source,
      states: input.states,
      transformation: {
        destructive: true,
        node: input.node,
        transform: (base, removed) => {
          const removedKeys = new Set(removed.map(canonicalValueKey));
          return base.filter((value) => !removedKeys.has(canonicalValueKey(value)));
        },
      },
    }),
    before: input.states,
    definite: input.operation.definite,
  });

const applySetClear = (input: {
  readonly node: ESTree.Span;
  readonly operation: Extract<SetMutationOperation, { readonly kind: "set-clear" }>;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> =>
  applySourcelessMutation({
    definite: input.operation.definite,
    states: input.states,
    transformation: { destructive: true, node: input.node, transform: () => [] },
  });

export const applySetMutationOperation = (input: {
  readonly node: ESTree.Span;
  readonly operation: SetMutationOperation;
  readonly states: CandidateSet<MutationState>;
}): CandidateSet<MutationState> => {
  if (input.operation.kind === "set-add") {
    return applySetAdd({ ...input, operation: input.operation });
  }
  if (input.operation.kind === "set-delete") {
    return applySetDelete({ ...input, operation: input.operation });
  }
  return applySetClear({ ...input, operation: input.operation });
};
