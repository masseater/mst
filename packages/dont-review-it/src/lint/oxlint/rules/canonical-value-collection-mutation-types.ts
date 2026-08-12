import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { CanonicalValueDomainFact } from "./canonical-value-domain.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueSinkEnvironment } from "./canonical-value-sink-environment.ts";

type ValueFact = Extract<CanonicalValueDomainFact, { readonly kind: "values" }>;
type UnregisteredFact = Extract<CanonicalValueDomainFact, { readonly kind: "unregistered" }>;
export type MutationFact = UnregisteredFact | ValueFact;

export type MutationState =
  | UnregisteredFact
  | (ValueFact & {
      readonly baselineLocalContribution: boolean;
      readonly baselineValues: readonly CanonicalValue[];
      readonly mutationContribution: boolean;
      readonly reportSingleton: boolean;
    });

export type MutationOperationPayload =
  | {
      readonly definite: boolean;
      readonly kind: "array-clear";
      readonly node: ESTree.AssignmentExpression;
    }
  | {
      readonly definite: boolean;
      readonly ends: CandidateSet<number | null>;
      readonly kind: "array-copy-within";
      readonly node: ESTree.CallExpression;
      readonly starts: CandidateSet<number>;
      readonly targets: CandidateSet<number>;
    }
  | {
      readonly definite: boolean;
      readonly indexes: CandidateSet<number>;
      readonly kind: "array-delete";
      readonly node: ESTree.CallExpression | ESTree.UnaryExpression;
    }
  | {
      readonly definite: boolean;
      readonly kind: "array-opaque";
      readonly node: ESTree.CallExpression;
    }
  | {
      readonly definite: boolean;
      readonly deltas: CandidateSet<number>;
      readonly indexes: CandidateSet<number>;
      readonly kind: "array-index-delta";
      readonly node: ESTree.AssignmentExpression | ESTree.UpdateExpression;
    }
  | {
      readonly definite: boolean;
      readonly kind: "array-insert";
      readonly method: string;
      readonly node: ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
    }
  | {
      readonly definite: boolean;
      readonly deleteCounts: CandidateSet<number | null>;
      readonly kind: "array-splice";
      readonly node: ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
      readonly starts: CandidateSet<number>;
    }
  | {
      readonly definite: boolean;
      readonly deltas: CandidateSet<number>;
      readonly kind: "array-length-delta";
      readonly node: ESTree.AssignmentExpression | ESTree.UpdateExpression;
    }
  | {
      readonly definite: boolean;
      readonly kind: "array-remove";
      readonly method: "pop" | "shift";
      readonly node: ESTree.CallExpression;
    }
  | {
      readonly definite: boolean;
      readonly kind: "array-truncate";
      readonly lengths: CandidateSet<number>;
      readonly node: ESTree.AssignmentExpression | ESTree.CallExpression;
    }
  | {
      readonly definite: boolean;
      readonly ends: CandidateSet<number | null>;
      readonly kind: "array-fill";
      readonly node: ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
      readonly starts: CandidateSet<number | null>;
    }
  | {
      readonly definite: boolean;
      readonly indexes: CandidateSet<number>;
      readonly kind: "array-index";
      readonly node: ESTree.AssignmentExpression | ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
    }
  | {
      readonly definite: boolean;
      readonly indexes: CandidateSet<number>;
      readonly kind: "array-logical-index";
      readonly node: ESTree.AssignmentExpression;
      readonly operator: "&&=" | "??=" | "||=";
      readonly source: CandidateSet<MutationFact>;
    }
  | {
      readonly definite: boolean;
      readonly kind: "set-add";
      readonly node: ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
    }
  | {
      readonly definite: boolean;
      readonly kind: "set-clear";
      readonly node: ESTree.CallExpression;
    }
  | {
      readonly definite: boolean;
      readonly kind: "set-delete";
      readonly node: ESTree.CallExpression;
      readonly source: CandidateSet<MutationFact>;
    };

export type MutationOperation = MutationOperationPayload & {
  readonly order: readonly number[];
};

export type MutationGroup = {
  readonly operations: MutationOperation[];
  readonly origin: CanonicalValueExpressionOrigin;
  readonly set: boolean;
};

export type CanonicalValueCollectionMutationSinkEnvironment = CanonicalValueSinkEnvironment;

export type CanonicalValueCollectionMutationSink = {
  readonly evaluate: (program: ESTree.Program) => void;
  readonly recordAssignment: (node: ESTree.AssignmentExpression) => void;
  readonly recordCall: (node: ESTree.CallExpression) => void;
  readonly recordUnary: (node: ESTree.UnaryExpression) => void;
  readonly recordUpdate: (node: ESTree.UpdateExpression) => void;
};
