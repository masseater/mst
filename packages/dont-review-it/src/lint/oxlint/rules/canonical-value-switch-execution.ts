import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  CanonicalValueExecutionContext,
  CanonicalValueGuard,
} from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueGuardExecution,
  CanonicalValueStaticPrimitive,
} from "./canonical-value-property-static.ts";
import type { CanonicalValueStaticQuery } from "./canonical-value-static-query.ts";

type StaticRuntime = {
  readonly resolve: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
};

const singlePrimitive = (
  candidates: CandidateSet<CanonicalValueStaticPrimitive>,
): CanonicalValueStaticPrimitive | symbol =>
  candidates.complete && candidates.candidates.length === 1
    ? (candidates.candidates[0] ?? Symbol.for("missing-static-primitive"))
    : Symbol.for("missing-static-primitive");

const primitiveAt = (
  runtime: StaticRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  },
): CanonicalValueStaticPrimitive | symbol =>
  singlePrimitive(runtime.resolve({ ...input.query, expression: input.expression }));

export const canonicalValueStatementIsDirectlyAbrupt = (statement: ESTree.Statement): boolean =>
  statement.type === "BreakStatement" ||
  statement.type === "ContinueStatement" ||
  statement.type === "ReturnStatement" ||
  statement.type === "ThrowStatement";

const fallthroughIsInterrupted = (
  cases: readonly ESTree.SwitchCase[],
  input: { readonly startIndex: number; readonly targetIndex: number },
): boolean =>
  cases
    .slice(input.startIndex, input.targetIndex)
    .some((candidate) => candidate.consequent.some(canonicalValueStatementIsDirectlyAbrupt));

const matchingEarlierCaseIndex = (
  runtime: StaticRuntime,
  input: {
    readonly cases: readonly ESTree.SwitchCase[];
    readonly discriminant: CanonicalValueStaticPrimitive;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
    readonly targetIndex: number;
  },
): number | null | "unknown" => {
  for (const [index, candidate] of input.cases.slice(0, input.targetIndex).entries()) {
    if (candidate.test === null) return "unknown";
    const test = primitiveAt(runtime, { expression: candidate.test, query: input.query });
    if (typeof test === "symbol") return "unknown";
    if (test === input.discriminant) return index;
  }
  return null;
};

const nonMatchingSwitchExecution = (
  runtime: StaticRuntime,
  input: {
    readonly discriminant: CanonicalValueStaticPrimitive;
    readonly guard: Extract<CanonicalValueGuard, { readonly kind: "switch-case" }>;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  },
): CanonicalValueGuardExecution => {
  const parent = input.guard.node.parent;
  if (parent.type !== "SwitchStatement") return { definite: false, executes: true };
  const targetIndex = parent.cases.indexOf(input.guard.node);
  const matching = matchingEarlierCaseIndex(runtime, {
    cases: parent.cases,
    discriminant: input.discriminant,
    query: input.query,
    targetIndex,
  });
  if (matching === "unknown") return { definite: false, executes: true };
  if (matching === null) return { definite: true, executes: false };
  return {
    definite: true,
    executes: !fallthroughIsInterrupted(parent.cases, {
      startIndex: matching,
      targetIndex,
    }),
  };
};

const matchingCaseIndex = (
  runtime: StaticRuntime,
  input: {
    readonly cases: readonly ESTree.SwitchCase[];
    readonly discriminant: CanonicalValueStaticPrimitive;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  },
): number | null | symbol => {
  for (const [index, candidate] of input.cases.entries()) {
    if (candidate.test === null) continue;
    const test = primitiveAt(runtime, { expression: candidate.test, query: input.query });
    if (typeof test === "symbol") return test;
    if (test === input.discriminant) return index;
  }
  return null;
};

const defaultSwitchExecution = (
  runtime: StaticRuntime,
  input: {
    readonly executionContext: CanonicalValueExecutionContext;
    readonly guard: Extract<CanonicalValueGuard, { readonly kind: "switch-case" }>;
  },
): CanonicalValueGuardExecution => {
  const parent = input.guard.node.parent;
  if (parent.type !== "SwitchStatement") return { definite: false, executes: true };
  const query = { cutoff: parent.discriminant.start, executionContext: input.executionContext };
  const discriminant = primitiveAt(runtime, { expression: parent.discriminant, query });
  if (typeof discriminant === "symbol") return { definite: false, executes: true };
  const matching = matchingCaseIndex(runtime, {
    cases: parent.cases,
    discriminant,
    query,
  });
  if (typeof matching === "symbol") return { definite: false, executes: true };
  if (matching === null) return { definite: true, executes: true };
  const targetIndex = parent.cases.indexOf(input.guard.node);
  return {
    definite: true,
    executes:
      matching < targetIndex &&
      !fallthroughIsInterrupted(parent.cases, {
        startIndex: matching,
        targetIndex,
      }),
  };
};

export const canonicalValueSwitchGuardExecution = (
  runtime: StaticRuntime,
  input: {
    readonly executionContext: CanonicalValueExecutionContext;
    readonly guard: Extract<CanonicalValueGuard, { readonly kind: "switch-case" }>;
  },
): CanonicalValueGuardExecution => {
  if (input.guard.test === null) return defaultSwitchExecution(runtime, input);
  const query = { cutoff: input.guard.test.start, executionContext: input.executionContext };
  const discriminant = primitiveAt(runtime, {
    expression: input.guard.discriminant,
    query,
  });
  const test = primitiveAt(runtime, { expression: input.guard.test, query });
  if (typeof discriminant === "symbol" || typeof test === "symbol") {
    return { definite: false, executes: true };
  }
  if (discriminant === test) return { definite: true, executes: true };
  return nonMatchingSwitchExecution(runtime, {
    discriminant,
    guard: input.guard,
    query,
  });
};
