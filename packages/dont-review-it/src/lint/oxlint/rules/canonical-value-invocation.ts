import { createCycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import { resolveCanonicalValueInvocationArgumentOrigins } from "./canonical-value-invocation-arguments.ts";
import { resolveCanonicalValueInvocationFacts } from "./canonical-value-invocation-normalization.ts";
import {
  recognizeCanonicalValueInvocationFacts,
  resolveCanonicalValueTargets,
} from "./canonical-value-invocation-target.ts";
import {
  createCanonicalValuePropertyState,
  type CanonicalValuePropertyState,
} from "./canonical-value-property-state.ts";

import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationInternals,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation-types.ts";

export type {
  CanonicalValueInvocationArgumentSegment,
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
  CanonicalValueRecognizedInvocation,
} from "./canonical-value-invocation-types.ts";

export const createCanonicalValueInvocationState = (
  bindingIndex: CanonicalValueBindingIndex,
  propertyState: CanonicalValuePropertyState,
): CanonicalValueInvocationState => {
  const state: CanonicalValueInvocationInternals = {
    argumentWidthMemo: createCycleMemo(),
    bindingIndex,
    callableMemo: createCycleMemo(),
    propertyState,
  };
  const invocationState: CanonicalValueInvocationState = {
    argumentOrigins: (invocation, index) =>
      resolveCanonicalValueInvocationArgumentOrigins(state, {
        index,
        segments: invocation.argumentSegments,
      }),
    facts: (invocation) => resolveCanonicalValueInvocationFacts(state, invocation),
    recognized: (invocation) =>
      recognizeCanonicalValueInvocationFacts(
        state,
        resolveCanonicalValueInvocationFacts(state, invocation),
      ),
    targets: (expression) => resolveCanonicalValueTargets(state, expression),
  };
  return invocationState;
};

export const createCanonicalValueRuntimeState = (
  bindingIndex: CanonicalValueBindingIndex,
): {
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
} => {
  const invocationAccess = {
    argumentOrigins: (...input: Parameters<CanonicalValueInvocationState["argumentOrigins"]>) =>
      invocationState.argumentOrigins(...input),
    facts: (...input: Parameters<CanonicalValueInvocationState["facts"]>) =>
      invocationState.facts(...input),
  } satisfies Pick<CanonicalValueInvocationState, "argumentOrigins" | "facts">;
  const propertyState = createCanonicalValuePropertyState(bindingIndex, invocationAccess);
  const invocationState = createCanonicalValueInvocationState(bindingIndex, propertyState);
  return { invocationState, propertyState };
};
