import {
  flatMapCandidateSet,
  mapCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  SCHEMA_ENUM_MEMBERS,
  SCHEMA_UNION_MEMBER,
} from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import { reportCanonicalValueDomainCandidates } from "./canonical-value-domain-report.ts";
import { type CanonicalValueRecognizedInvocation } from "./canonical-value-invocation.ts";
import {
  resolveCanonicalValueSchemaUnionOrigins,
  type CanonicalValueSchemaUnion,
} from "./canonical-value-schema-union.ts";
import { type CanonicalValueSinkEnvironment } from "./canonical-value-sink-environment.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueExecutionContext } from "./canonical-value-binding-types.ts";

export type CanonicalValueInvocationSinkEnvironment = CanonicalValueSinkEnvironment;

export type CanonicalValueInvocationSink = {
  readonly evaluate: (program: ESTree.Program) => void;
  readonly record: (node: ESTree.CallExpression | ESTree.NewExpression) => void;
};

const domainFromArgument = (
  invocation: CanonicalValueRecognizedInvocation,
  environment: CanonicalValueInvocationSinkEnvironment,
): CandidateSet<CanonicalValueDomainFact> =>
  flatMapCandidateSet(environment.invocationState.argumentOrigins(invocation, 0), {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (origin) => environment.domain.origin({ origin }),
  });

const unionDomainFact = (union: CanonicalValueSchemaUnion): CanonicalValueDomainFact => ({
  derivedFromRegisteredRoute: false,
  kind: "values",
  localContribution: true,
  node: union.node,
  values: union.values,
});

const schemaUnionDomain = (
  invocation: CanonicalValueRecognizedInvocation,
  environment: CanonicalValueInvocationSinkEnvironment,
): CandidateSet<CanonicalValueDomainFact> =>
  mapCandidateSet(
    resolveCanonicalValueSchemaUnionOrigins(
      environment,
      environment.invocationState.argumentOrigins(invocation, 0),
    ),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: unionDomainFact,
    },
  );

const reportInvocationDomain = (
  environment: CanonicalValueInvocationSinkEnvironment,
  query: {
    readonly candidates: CandidateSet<CanonicalValueDomainFact>;
    readonly onlyWhenOwned: boolean;
    readonly reportIncompleteValues: boolean;
  },
): void => {
  reportCanonicalValueDomainCandidates({
    candidates: query.candidates,
    onlyWhenOwned: query.onlyWhenOwned,
    reportIncompleteValues: query.reportIncompleteValues,
    reporter: environment.reporter,
  });
};

const evaluateSchemaInvocation = (
  invocation: CanonicalValueRecognizedInvocation,
  environment: CanonicalValueInvocationSinkEnvironment,
): void => {
  if (invocation.target.kind !== "schema") return;
  if (SCHEMA_ENUM_MEMBERS.has(invocation.target.member)) {
    reportInvocationDomain(environment, {
      candidates: domainFromArgument(invocation, environment),
      onlyWhenOwned: false,
      reportIncompleteValues: true,
    });
  }
  if (invocation.target.member === SCHEMA_UNION_MEMBER) {
    reportInvocationDomain(environment, {
      candidates: schemaUnionDomain(invocation, environment),
      onlyWhenOwned: false,
      reportIncompleteValues: true,
    });
  }
};

const evaluateRecognizedInvocation = (
  invocation: CanonicalValueRecognizedInvocation,
  environment: CanonicalValueInvocationSinkEnvironment,
): void => {
  evaluateSchemaInvocation(invocation, environment);
  if (invocation.target.kind === "set-constructor") {
    reportInvocationDomain(environment, {
      candidates: domainFromArgument(invocation, environment),
      onlyWhenOwned: true,
      reportIncompleteValues: false,
    });
  }
};

const evaluateInvocation = (
  node: ESTree.CallExpression | ESTree.NewExpression,
  environment: CanonicalValueInvocationSinkEnvironment,
): void => {
  for (const invocation of environment.invocationState.recognized(node).candidates) {
    evaluateRecognizedInvocation(invocation, environment);
  }
};

const contextNeedsInvocation = (context: CanonicalValueExecutionContext): boolean =>
  context.node.type !== "Program";

const invocationExecutes = (
  environment: CanonicalValueInvocationSinkEnvironment,
  input: {
    readonly node: ESTree.CallExpression | ESTree.NewExpression;
    readonly program: ESTree.Program;
  },
): boolean => {
  const execution = environment.propertyState.execution(input.node);
  if (execution.definite && !execution.executes) return false;
  const context = environment.bindingIndex.executionContextAt(input.node);
  if (!contextNeedsInvocation(context)) return true;
  const occurrences = environment.bindingIndex.executionOccurrencesOf(input.node, {
    cutoff: input.program.end,
    executionContext: environment.bindingIndex.executionContextAt(input.program),
  });
  return occurrences.some((occurrence) =>
    occurrence.callSites.every((callSite) => {
      const callExecution = environment.propertyState.execution(callSite);
      return !callExecution.definite || callExecution.executes;
    }),
  );
};

export const createCanonicalValueInvocationSink = (
  environment: CanonicalValueInvocationSinkEnvironment,
): CanonicalValueInvocationSink => {
  const invocations = new Set<ESTree.CallExpression | ESTree.NewExpression>();
  return {
    evaluate: (program) => {
      for (const invocation of invocations) {
        if (invocationExecutes(environment, { node: invocation, program })) {
          evaluateInvocation(invocation, environment);
        }
      }
    },
    record: (node) => {
      invocations.add(node);
    },
  };
};
