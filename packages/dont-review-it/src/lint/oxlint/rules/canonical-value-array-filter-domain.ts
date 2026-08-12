import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  type CanonicalValue,
} from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import { resolveCanonicalValueBinaryPrimitive } from "./canonical-value-static-binary.ts";
import {
  canonicalValueStaticPrimitiveKey,
  canonicalValueStaticPrimitiveIsTruthy,
  resolveCanonicalValueUnaryPrimitive,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValuePropertyNameEnvironment } from "./canonical-value-property-name-domain.ts";
import type { CanonicalValueScalarContext } from "./canonical-value-scalar-domain.ts";

type PredicateEnvironment = CanonicalValuePropertyNameEnvironment;

export type CanonicalValueCallbackPrimitiveQuery = {
  readonly overrides: ReadonlyMap<Variable, CanonicalValueStaticPrimitive>;
  readonly query: CanonicalValueScalarContext;
  readonly receiverExpression: ESTree.Expression;
  readonly receiverValues: readonly CanonicalValue[];
};

const staticPrimitives = (
  environment: PredicateEnvironment,
  input: CanonicalValueScalarContext & { readonly expression: ESTree.Expression },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  environment.propertyState.primitives({
    ...input,
  });

const parameterBinding = (
  environment: PredicateEnvironment,
  parameter: ESTree.ParamPattern | undefined,
): Variable | null => {
  if (parameter === undefined) return null;
  const target = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
  return target.type === "Identifier" ? environment.bindingIndex.resolveIdentifier(target) : null;
};

const branchPrimitives = (
  environment: PredicateEnvironment,
  input: {
    readonly expression: ESTree.ConditionalExpression;
  } & CanonicalValueCallbackPrimitiveQuery,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const tests = resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
    ...input,
    expression: input.expression.test,
  });
  const truthy = tests.candidates.some(canonicalValueStaticPrimitiveIsTruthy);
  const falsy = tests.candidates.some(
    (primitive) => !canonicalValueStaticPrimitiveIsTruthy(primitive),
  );
  const branches = [
    ...(truthy
      ? [
          resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
            ...input,
            expression: input.expression.consequent,
          }),
        ]
      : []),
    ...(falsy
      ? [
          resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
            ...input,
            expression: input.expression.alternate,
          }),
        ]
      : []),
  ];
  if (branches.length === 0) return unknownCandidateSet();
  const joined = joinCandidateSets(branches, canonicalValueStaticPrimitiveKey);
  return tests.complete
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueStaticPrimitiveKey);
};

const logicalPrimitives = (
  environment: PredicateEnvironment,
  input: {
    readonly expression: ESTree.LogicalExpression;
  } & CanonicalValueCallbackPrimitiveQuery,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(
    resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
      ...input,
      expression: input.expression.left,
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (left) => {
        const useRight =
          input.expression.operator === "??"
            ? left === null || left === undefined
            : input.expression.operator === "&&"
              ? canonicalValueStaticPrimitiveIsTruthy(left)
              : !canonicalValueStaticPrimitiveIsTruthy(left);
        return useRight
          ? resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
              ...input,
              expression: input.expression.right,
            })
          : closedCandidateSet([left], canonicalValueStaticPrimitiveKey);
      },
    },
  );

const sameReceiver = (
  environment: PredicateEnvironment,
  input: { readonly left: ESTree.Expression; readonly right: ESTree.Expression },
): boolean => {
  const unwrappedLeft = unwrapExpression(input.left);
  const unwrappedRight = unwrapExpression(input.right);
  if (unwrappedLeft === unwrappedRight) return true;
  if (unwrappedLeft.type !== "Identifier" || unwrappedRight.type !== "Identifier") return false;
  const leftBinding = environment.bindingIndex.resolveIdentifier(unwrappedLeft);
  return (
    leftBinding !== null &&
    leftBinding === environment.bindingIndex.resolveIdentifier(unwrappedRight)
  );
};

const receiverMemberPrimitives = (
  environment: PredicateEnvironment,
  input: CanonicalValueCallbackPrimitiveQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    input.expression.object.type === "Super" ||
    !sameReceiver(environment, {
      left: input.expression.object,
      right: input.receiverExpression,
    })
  ) {
    return null;
  }
  const keys = environment.propertyState.propertyKeys({
    computed: input.expression.computed,
    cutoff: input.query.cutoff,
    executionContext: input.query.executionContext,
    key: input.expression.property,
  });
  const candidates = keys.candidates
    .flatMap((key) => {
      const index = Number(key);
      return Number.isSafeInteger(index) && String(index) === key
        ? [input.receiverValues[index]]
        : [];
    })
    .filter((value): value is CanonicalValue => value !== undefined);
  if (candidates.length === 0) return null;
  return keys.complete
    ? closedCandidateSet(candidates, canonicalValueStaticPrimitiveKey)
    : openCandidateSet(candidates, canonicalValueStaticPrimitiveKey);
};

const identifierPrimitives = (
  environment: PredicateEnvironment,
  input: CanonicalValueCallbackPrimitiveQuery & {
    readonly expression: Extract<ESTree.Expression, { readonly type: "Identifier" }>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const binding = environment.bindingIndex.resolveIdentifier(input.expression);
  const primitive = binding === null ? undefined : input.overrides.get(binding);
  return primitive === undefined
    ? staticPrimitives(environment, { ...input.query, expression: input.expression })
    : closedCandidateSet([primitive], canonicalValueStaticPrimitiveKey);
};

const operatorPrimitives = (
  environment: PredicateEnvironment,
  input: CanonicalValueCallbackPrimitiveQuery & { readonly expression: ESTree.Expression },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    input.expression.type === "BinaryExpression" &&
    input.expression.left.type !== "PrivateIdentifier"
  ) {
    return resolveCanonicalValueBinaryPrimitive({
      expression: input.expression as ESTree.BinaryExpression & {
        readonly left: ESTree.Expression;
      },
      resolve: (operand) =>
        resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
          ...input,
          expression: operand,
        }),
    });
  }
  if (input.expression.type !== "UnaryExpression") return null;
  const expression = input.expression;
  return flatMapCandidateSet(
    resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
      ...input,
      expression: expression.argument,
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (primitive) =>
        resolveCanonicalValueUnaryPrimitive(expression.operator, primitive),
    },
  );
};

const structuredPrimitives = (
  environment: PredicateEnvironment,
  input: CanonicalValueCallbackPrimitiveQuery & { readonly expression: ESTree.Expression },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (input.expression.type === "ConditionalExpression") {
    return branchPrimitives(environment, { ...input, expression: input.expression });
  }
  if (input.expression.type === "LogicalExpression") {
    return logicalPrimitives(environment, { ...input, expression: input.expression });
  }
  return input.expression.type === "MemberExpression"
    ? receiverMemberPrimitives(environment, { ...input, expression: input.expression })
    : null;
};

export const resolveCanonicalValueCallbackPrimitiveCandidates = (
  environment: PredicateEnvironment,
  input: {
    readonly expression: ESTree.Expression;
  } & CanonicalValueCallbackPrimitiveQuery,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const expression = unwrapExpression(input.expression);
  if (expression.type === "Identifier")
    return identifierPrimitives(environment, { ...input, expression });
  const operator = operatorPrimitives(environment, { ...input, expression });
  if (operator !== null) return operator;
  const structured = structuredPrimitives(environment, { ...input, expression });
  return structured ?? staticPrimitives(environment, { ...input.query, expression });
};

const callbackPredicatePrimitives = (
  environment: PredicateEnvironment,
  input: {
    readonly index: number;
    readonly query: CanonicalValueScalarContext;
    readonly receiverExpression: ESTree.Expression;
    readonly receiverValues: readonly CanonicalValue[];
    readonly value: CanonicalValue;
    readonly callback: ReturnType<
      PredicateEnvironment["bindingIndex"]["collectionCallbackResults"]
    >[number];
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const overrides = new Map<Variable, CanonicalValueStaticPrimitive>();
  const valueBinding = parameterBinding(environment, input.callback.functionNode.params[0]);
  const indexBinding = parameterBinding(environment, input.callback.functionNode.params[1]);
  if (valueBinding !== null) overrides.set(valueBinding, input.value);
  if (indexBinding !== null) overrides.set(indexBinding, input.index);
  if (input.callback.returnExpressions.length === 0) return unknownCandidateSet();
  return joinCandidateSets(
    input.callback.returnExpressions.map((expression) =>
      resolveCanonicalValueCallbackPrimitiveCandidates(environment, {
        expression,
        overrides,
        query: input.query,
        receiverExpression: input.receiverExpression,
        receiverValues: input.receiverValues,
      }),
    ),
    canonicalValueStaticPrimitiveKey,
  );
};

const predicateChoices = (
  candidates: CandidateSet<CanonicalValueStaticPrimitive>,
): CandidateSet<boolean> => {
  const choices = [...new Set(candidates.candidates.map(canonicalValueStaticPrimitiveIsTruthy))];
  if (!candidates.complete) {
    return openCandidateSet([...new Set([...choices, true, false])], String);
  }
  return closedCandidateSet(choices, String);
};

const filteredVectors = (
  environment: PredicateEnvironment,
  input: {
    readonly callbacks: ReturnType<
      PredicateEnvironment["bindingIndex"]["collectionCallbackResults"]
    >;
    readonly query: CanonicalValueScalarContext;
    readonly receiverExpression: ESTree.Expression;
    readonly values: readonly CanonicalValue[];
  },
): CandidateSet<readonly CanonicalValue[]> =>
  input.values
    .map((value, index) => ({ index, value }))
    .reduce<CandidateSet<readonly CanonicalValue[]>>(
      (vectors, step) => {
        const predicates = joinCandidateSets(
          input.callbacks.map((callback) =>
            callbackPredicatePrimitives(environment, {
              callback,
              index: step.index,
              query: input.query,
              receiverExpression: input.receiverExpression,
              receiverValues: input.values,
              value: step.value,
            }),
          ),
          canonicalValueStaticPrimitiveKey,
        );
        return flatMapCandidateSet(vectors, {
          candidateKey: (vector) => vector.map(canonicalValueKey).join("|"),
          mapCandidate: (vector) =>
            flatMapCandidateSet(predicateChoices(predicates), {
              candidateKey: (candidate) => candidate.map(canonicalValueKey).join("|"),
              mapCandidate: (keep) =>
                closedCandidateSet([keep ? [...vector, step.value] : vector], (candidate) =>
                  candidate.map(canonicalValueKey).join("|"),
                ),
            }),
        });
      },
      closedCandidateSet([[]], (vector) => vector.map(canonicalValueKey).join("|")),
    );

export const resolveCanonicalValueArrayFilterDomain = (
  environment: PredicateEnvironment,
  input: {
    readonly call: ESTree.CallExpression;
    readonly fact: CanonicalValueDomainFact;
    readonly query: CanonicalValueScalarContext;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const fact = input.fact;
  if (fact.kind === "unregistered") {
    return openCandidateSet([fact], canonicalValueDomainFactIdentity);
  }
  if (fact.kind !== "values") return unknownCandidateSet();
  const callbacks = environment.bindingIndex.collectionCallbackResults(input.call);
  if (callbacks.length === 0) return unknownCandidateSet();
  const callee = unwrapExpression(input.call.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(
    filteredVectors(environment, {
      callbacks,
      query: input.query,
      receiverExpression: callee.object,
      values: fact.values,
    }),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (values) =>
        closedCandidateSet(
          [
            {
              ...fact,
              localContribution:
                fact.localContribution ||
                fingerprintValues(values) !== fingerprintValues(fact.values),
              values,
            },
          ],
          canonicalValueDomainFactIdentity,
        ),
    },
  );
};
