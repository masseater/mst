import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  CanonicalValueExecutionContext,
  CanonicalValueGuard,
} from "./canonical-value-binding-index.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueGuardExecution } from "./canonical-value-property-static.ts";

type IterationGuard = Extract<CanonicalValueGuard, { readonly kind: "iteration" }>;

const staticString = (expression: ESTree.Expression): string | null => {
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return expression.value;
  }
  if (expression.type !== "TemplateLiteral" || expression.expressions.length !== 0) return null;
  return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? "";
};

const arrayExecution = (expression: ESTree.ArrayExpression): CanonicalValueGuardExecution => {
  if (expression.elements.length === 0) return { definite: true, executes: false };
  return expression.elements.some((element) => element !== null && element.type !== "SpreadElement")
    ? { definite: true, executes: true }
    : { definite: false, executes: true };
};

const objectExecution = (expression: ESTree.ObjectExpression): CanonicalValueGuardExecution => {
  if (expression.properties.length === 0) return { definite: true, executes: false };
  return expression.properties.some((property) => property.type === "Property")
    ? { definite: true, executes: true }
    : { definite: false, executes: true };
};

const expressionIterationExecution = (
  expression: ESTree.Expression,
  operator: IterationGuard["operator"],
): CanonicalValueGuardExecution => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type === "ArrayExpression") return arrayExecution(unwrapped);
  if (operator === "in" && unwrapped.type === "ObjectExpression") {
    return objectExecution(unwrapped);
  }
  const string = staticString(unwrapped);
  if (string === null) return { definite: false, executes: true };
  return { definite: true, executes: string.length !== 0 };
};

const originExecution = (
  origin: CanonicalValueOrigin,
  operator: IterationGuard["operator"],
): CanonicalValueGuardExecution =>
  origin.kind === "expression" && origin.projections.length === 0
    ? expressionIterationExecution(origin.expression, operator)
    : { definite: false, executes: true };

export const canonicalValueIterationGuardExecution = (input: {
  readonly executionContext: CanonicalValueExecutionContext;
  readonly guard: IterationGuard;
  readonly resolveOrigins: (query: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValueExecutionContext;
    readonly expression: ESTree.Expression;
  }) => CandidateSet<CanonicalValueOrigin>;
}): CanonicalValueGuardExecution => {
  const direct = expressionIterationExecution(input.guard.source, input.guard.operator);
  if (direct.definite) return direct;
  const origins = input.resolveOrigins({
    cutoff: input.guard.source.start,
    executionContext: input.executionContext,
    expression: input.guard.source,
  });
  const executions = origins.candidates.map((origin) =>
    originExecution(origin, input.guard.operator),
  );
  const first = executions[0];
  if (
    !origins.complete ||
    first === undefined ||
    executions.some((execution) => !execution.definite)
  ) {
    return { definite: false, executes: true };
  }
  return executions.every((execution) => execution.executes === first.executes)
    ? first
    : { definite: false, executes: true };
};
