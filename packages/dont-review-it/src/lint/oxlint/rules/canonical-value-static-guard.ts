import { canonicalValueCatchExecution } from "./canonical-value-catch-execution.ts";
import { canonicalValueIterationGuardExecution } from "./canonical-value-iteration-execution.ts";
import { canonicalValueSwitchGuardExecution } from "./canonical-value-switch-execution.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  CanonicalValueBindingIndex,
  CanonicalValueExecutionContext,
  CanonicalValueGuard,
} from "./canonical-value-binding-index.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type {
  CanonicalValueGuardExecution,
  CanonicalValueStaticCondition,
} from "./canonical-value-property-static.ts";
import type { CanonicalValueStaticPrimitive } from "./canonical-value-static-primitive.ts";
import type { CanonicalValueStaticQuery } from "./canonical-value-static-query.ts";

type StaticGuardRuntime = {
  readonly condition: (query: CanonicalValueStaticQuery) => CanonicalValueStaticCondition | null;
  readonly resolve: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
  readonly resolveOrigins: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueOrigin>;
};

const guardOutcomeHolds = (
  condition: CanonicalValueStaticCondition,
  outcome: Extract<CanonicalValueGuard, { readonly kind: "condition" }>["outcome"],
): boolean =>
  outcome === "nullish"
    ? condition.nullish
    : outcome === "non-nullish"
      ? !condition.nullish
      : outcome === "truthy"
        ? condition.truthy
        : !condition.truthy;

const conditionGuardExecution = (
  runtime: StaticGuardRuntime,
  input: {
    readonly executionContext: CanonicalValueExecutionContext;
    readonly guard: Extract<CanonicalValueGuard, { readonly kind: "condition" }>;
  },
): CanonicalValueGuardExecution => {
  const condition = runtime.condition({
    cutoff: input.guard.test.start,
    executionContext: input.executionContext,
    expression: input.guard.test,
  });
  return condition === null
    ? { definite: false, executes: true }
    : { definite: true, executes: guardOutcomeHolds(condition, input.guard.outcome) };
};

export const canonicalValueStaticGuardExecution = (
  runtime: StaticGuardRuntime,
  input: {
    readonly executionContext: CanonicalValueExecutionContext;
    readonly guard: CanonicalValueGuard;
  },
): CanonicalValueGuardExecution => {
  const { executionContext, guard } = input;
  if (guard.kind === "condition") {
    return conditionGuardExecution(runtime, { executionContext, guard });
  }
  if (guard.kind === "iteration") {
    return canonicalValueIterationGuardExecution({
      executionContext,
      guard,
      resolveOrigins: runtime.resolveOrigins,
    });
  }
  if (guard.kind === "catch") {
    return canonicalValueCatchExecution({
      guard,
      resolvedPrimitive: (expression) => {
        const primitives = runtime.resolve({
          cutoff: expression.start,
          executionContext,
          expression,
        });
        return primitives.complete && primitives.candidates.length !== 0;
      },
    });
  }
  return canonicalValueSwitchGuardExecution(runtime, { executionContext, guard });
};

export const canonicalValueStaticNodeGuardExecution = (
  runtime: StaticGuardRuntime,
  input: { readonly bindingIndex: CanonicalValueBindingIndex; readonly node: ESTree.Node },
): CanonicalValueGuardExecution => {
  const executionContext = input.bindingIndex.executionContextAt(input.node);
  const executions = input.bindingIndex
    .guardsAt(input.node)
    .map((guard) => canonicalValueStaticGuardExecution(runtime, { executionContext, guard }));
  const prevented = executions.find((execution) => execution.definite && !execution.executes);
  return (
    prevented ?? {
      definite: executions.every((execution) => execution.definite && execution.executes),
      executes: true,
    }
  );
};
