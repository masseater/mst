import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueArrayReduceCallbackFacts,
  canonicalValueArrayReduceCollectionFacts,
} from "./canonical-value-array-reduce-callback.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import {
  type CanonicalValueCollectionQuery,
  type CanonicalValueCollectionResolution,
} from "./canonical-value-collection-query.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";

import type { ESTree } from "@oxlint/plugins";

const initialFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly call: ESTree.CallExpression;
    readonly query: CanonicalValueCollectionQuery;
    readonly receiverFact: Extract<CanonicalValueDomainFact, { readonly kind: "values" }>;
  },
): {
  readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
  readonly values: readonly CanonicalValue[];
} | null => {
  const initial = canonicalValueArgumentExpression(input.call.arguments[1]);
  if (initial !== null) {
    return {
      accumulator: canonicalValueArrayReduceCollectionFacts(resolution, {
        expression: initial,
        query: input.query,
      }),
      values: input.receiverFact.values,
    };
  }
  const [first, ...remaining] = input.receiverFact.values;
  if (first === undefined) return null;
  return {
    accumulator: closedCandidateSet(
      [{ ...input.receiverFact, localContribution: true, values: [first] }],
      canonicalValueDomainFactIdentity,
    ),
    values: remaining,
  };
};

const reducedFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly callbacks: ReturnType<
      CanonicalValueCollectionResolution["environment"]["bindingIndex"]["collectionCallbackResults"]
    >;
    readonly elements: readonly CanonicalValue[];
    readonly fromRight: boolean;
    readonly initial: CandidateSet<CanonicalValueDomainFact>;
    readonly query: CanonicalValueCollectionQuery;
    readonly receiverExpression: ESTree.Expression;
    readonly receiverFact: Extract<CanonicalValueDomainFact, { readonly kind: "values" }>;
  },
): CandidateSet<CanonicalValueDomainFact> =>
  input.elements
    .map((current, index) => ({ current, index }))
    .reduce<CandidateSet<CanonicalValueDomainFact>>(
      (accumulator, step) =>
        flatMapCandidateSet(accumulator, {
          candidateKey: canonicalValueDomainFactIdentity,
          mapCandidate: (fact) =>
            joinCandidateSets(
              input.callbacks.map((callback) =>
                canonicalValueArrayReduceCallbackFacts(resolution, {
                  accumulator: closedCandidateSet([fact], canonicalValueDomainFactIdentity),
                  callback,
                  evaluation: {
                    current: step.current,
                    index: input.fromRight
                      ? input.receiverFact.values.length - step.index - 1
                      : step.index,
                    query: input.query,
                    receiverExpression: input.receiverExpression,
                    receiverFact: input.receiverFact,
                  },
                }),
              ),
              canonicalValueDomainFactIdentity,
            ),
        }),
      input.initial,
    );

const resolveValueArrayReduceDomain = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly call: ESTree.CallExpression;
    readonly fromRight: boolean;
    readonly query: CanonicalValueCollectionQuery;
    readonly receiverFact: Extract<CanonicalValueDomainFact, { readonly kind: "values" }>;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const callbacks = resolution.environment.bindingIndex.collectionCallbackResults(input.call);
  if (callbacks.length === 0) return unknownCandidateSet();
  const callee = unwrapExpression(input.call.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") {
    return unknownCandidateSet();
  }
  const initial = initialFacts(resolution, {
    call: input.call,
    query: input.query,
    receiverFact: input.receiverFact,
  });
  if (initial === null) return unknownCandidateSet();
  return reducedFacts(resolution, {
    callbacks,
    elements: input.fromRight ? initial.values.toReversed() : initial.values,
    fromRight: input.fromRight,
    initial: initial.accumulator,
    query: input.query,
    receiverExpression: callee.object,
    receiverFact: input.receiverFact,
  });
};

export const resolveCanonicalValueArrayReduceDomain = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly call: ESTree.CallExpression;
    readonly fact: CanonicalValueDomainFact;
    readonly fromRight: boolean;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (input.fact.kind === "unregistered") {
    return openCandidateSet([input.fact], canonicalValueDomainFactIdentity);
  }
  return input.fact.kind === "values"
    ? resolveValueArrayReduceDomain(resolution, {
        call: input.call,
        fromRight: input.fromRight,
        query: input.query,
        receiverFact: input.fact,
      })
    : unknownCandidateSet();
};
