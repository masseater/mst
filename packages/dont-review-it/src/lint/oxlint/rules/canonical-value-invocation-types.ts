import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import type {
  CanonicalValueBindingIndex,
  CanonicalValueCallArgumentSegment,
  CanonicalValueExecutionContext,
} from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueExpressionOrigin,
  CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueSchemaMember = string;

export type CanonicalValueInvocationArgumentSegment = Exclude<
  CanonicalValueCallArgumentSegment,
  { readonly kind: "unknown" }
>;

export type CanonicalValueInvocationFact = {
  readonly argumentSegments: readonly CanonicalValueInvocationArgumentSegment[];
  readonly target: CanonicalValueExpressionOrigin;
  readonly thisArgument: ESTree.Expression | null;
};

export type CanonicalValueInvocationTarget =
  | {
      readonly kind: "schema";
      readonly member: CanonicalValueSchemaMember;
      readonly origin: CanonicalValueExpressionOrigin;
    }
  | {
      readonly kind: "set-add";
      readonly origin: CanonicalValueExpressionOrigin;
      readonly receiver: CanonicalValueExpressionOrigin;
    }
  | {
      readonly kind: "set-clear";
      readonly origin: CanonicalValueExpressionOrigin;
      readonly receiver: CanonicalValueExpressionOrigin;
    }
  | {
      readonly kind: "set-constructor";
      readonly origin: CanonicalValueExpressionOrigin;
    }
  | {
      readonly kind: "set-delete";
      readonly origin: CanonicalValueExpressionOrigin;
      readonly receiver: CanonicalValueExpressionOrigin;
    };

export type CanonicalValueRecognizedInvocation = Omit<CanonicalValueInvocationFact, "target"> & {
  readonly target: CanonicalValueInvocationTarget;
};

export type CanonicalValueInvocationState = {
  readonly argumentOrigins: (
    invocation: { readonly argumentSegments: readonly CanonicalValueInvocationArgumentSegment[] },
    index: number,
  ) => CandidateSet<CanonicalValueOrigin>;
  readonly facts: (
    invocation: ESTree.CallExpression | ESTree.NewExpression,
  ) => CandidateSet<CanonicalValueInvocationFact>;
  readonly recognized: (
    invocation: ESTree.CallExpression | ESTree.NewExpression,
  ) => CandidateSet<CanonicalValueRecognizedInvocation>;
  readonly targets: (expression: ESTree.Expression) => CandidateSet<CanonicalValueInvocationTarget>;
};

export type CanonicalValueCallableCandidate = {
  readonly argumentSegments: readonly CanonicalValueInvocationArgumentSegment[];
  readonly boundThis: ESTree.Expression | null;
  readonly directThis: ESTree.Expression | null;
  readonly target: CanonicalValueExpressionOrigin;
};

export type CanonicalValueInvocationInternals = {
  readonly argumentWidthMemo: CycleMemo<
    CandidateSet<number>,
    object,
    "argument-width",
    CanonicalValueExecutionContext
  >;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly callableMemo: CycleMemo<
    CandidateSet<CanonicalValueCallableCandidate>,
    object,
    "callable",
    CanonicalValueExecutionContext
  >;
  readonly propertyState: CanonicalValuePropertyState;
};
