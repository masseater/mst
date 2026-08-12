import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  openCandidateSet,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  resolveCanonicalValueCallbackPrimitiveCandidates,
  type CanonicalValueCallbackPrimitiveQuery,
} from "./canonical-value-array-filter-domain.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import {
  type CanonicalValueCollectionQuery,
  type CanonicalValueCollectionResolution,
} from "./canonical-value-collection-query.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueFragment } from "./canonical-value-domain-fragment.ts";
import type { CanonicalValuePropertyNameEnvironment } from "./canonical-value-property-name-domain.ts";

type ReduceCallback = ReturnType<
  CanonicalValuePropertyNameEnvironment["bindingIndex"]["collectionCallbackResults"]
>[number];

type ReduceBindings = {
  readonly accumulator: Variable | null;
  readonly index: Variable | null;
  readonly value: Variable | null;
};

type ReduceEvaluation = {
  readonly bindings: ReduceBindings;
  readonly current: CanonicalValue;
  readonly index: number;
  readonly query: CanonicalValueCollectionQuery;
  readonly receiverExpression: ESTree.Expression;
  readonly receiverFact: Extract<CanonicalValueDomainFact, { readonly kind: "values" }>;
};

const parameterBinding = (
  environment: CanonicalValuePropertyNameEnvironment,
  parameter: ESTree.ParamPattern | undefined,
): Variable | null => {
  if (parameter === undefined) return null;
  const target = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
  return target.type === "Identifier" ? environment.bindingIndex.resolveIdentifier(target) : null;
};

const callbackBindings = (
  environment: CanonicalValuePropertyNameEnvironment,
  callback: ReduceCallback,
): ReduceBindings => ({
  accumulator: parameterBinding(environment, callback.functionNode.params[0]),
  index: parameterBinding(environment, callback.functionNode.params[2]),
  value: parameterBinding(environment, callback.functionNode.params[1]),
});

const sameBinding = (
  environment: CanonicalValuePropertyNameEnvironment,
  input: { readonly binding: Variable | null; readonly expression: ESTree.Expression },
): boolean => {
  const unwrapped = unwrapExpression(input.expression);
  return (
    input.binding !== null &&
    unwrapped.type === "Identifier" &&
    environment.bindingIndex.resolveIdentifier(unwrapped) === input.binding
  );
};

const fragmentFact = (
  node: ESTree.Expression,
  fragment: CanonicalValueFragment,
): CanonicalValueDomainFact =>
  fragment.kind === "unregistered"
    ? fragment
    : {
        catalogBindingContribution: fragment.catalogBindingContribution,
        derivedFromRegisteredRoute: fragment.derivedFromRegisteredRoute,
        kind: "values",
        localContribution: fragment.localContribution,
        node,
        values: fragment.values,
      };

export const canonicalValueArrayReduceCollectionFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: CanonicalValueCollectionQuery;
  },
): CandidateSet<CanonicalValueDomainFact> =>
  flatMapCandidateSet(
    resolution.collectionFragments({ ...input.query, expression: input.expression }),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (fragment) =>
        closedCandidateSet(
          [fragmentFact(input.expression, fragment)],
          canonicalValueDomainFactIdentity,
        ),
    },
  );

const appendedFact = (
  left: CanonicalValueDomainFact,
  right: CanonicalValueDomainFact,
): CanonicalValueDomainFact => {
  if (left.kind !== "values") return left;
  if (right.kind !== "values") return right;
  return {
    catalogBindingContribution:
      left.catalogBindingContribution === true || right.catalogBindingContribution === true,
    derivedFromRegisteredRoute: left.derivedFromRegisteredRoute || right.derivedFromRegisteredRoute,
    kind: "values",
    localContribution: left.localContribution || right.localContribution,
    node: left.node,
    values: [...left.values, ...right.values],
  };
};

const appendFacts = (
  accumulated: CandidateSet<CanonicalValueDomainFact>,
  next: CandidateSet<CanonicalValueDomainFact>,
): CandidateSet<CanonicalValueDomainFact> =>
  appendCandidateSets({
    accumulated,
    append: appendedFact,
    candidateKey: canonicalValueDomainFactIdentity,
    next,
  });

const primitiveQuery = (
  evaluation: ReduceEvaluation,
  input: {
    readonly expression: ESTree.Expression;
    readonly overrides: ReadonlyMap<Variable, CanonicalValue>;
  },
): CanonicalValueCallbackPrimitiveQuery & { readonly expression: ESTree.Expression } => ({
  expression: input.expression,
  overrides: input.overrides,
  query: evaluation.query,
  receiverExpression: evaluation.receiverExpression,
  receiverValues: evaluation.receiverFact.values,
});

const scalarFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: { readonly evaluation: ReduceEvaluation; readonly expression: ESTree.Expression },
): CandidateSet<CanonicalValueDomainFact> => {
  const overrides = new Map<Variable, CanonicalValue>();
  if (input.evaluation.bindings.value !== null) {
    overrides.set(input.evaluation.bindings.value, input.evaluation.current);
  }
  if (input.evaluation.bindings.index !== null) {
    overrides.set(input.evaluation.bindings.index, input.evaluation.index);
  }
  return flatMapCandidateSet(
    resolveCanonicalValueCallbackPrimitiveCandidates(
      resolution.environment,
      primitiveQuery(input.evaluation, { expression: input.expression, overrides }),
    ),
    {
      candidateKey: canonicalValueDomainFactIdentity,
      mapCandidate: (primitive) =>
        primitive === undefined || typeof primitive === "bigint"
          ? unknownCandidateSet()
          : closedCandidateSet(
              [
                {
                  catalogBindingContribution:
                    input.evaluation.receiverFact.catalogBindingContribution,
                  derivedFromRegisteredRoute:
                    input.evaluation.receiverFact.derivedFromRegisteredRoute,
                  kind: "values",
                  localContribution: true,
                  node: input.evaluation.query.expression,
                  values: [primitive],
                },
              ],
              canonicalValueDomainFactIdentity,
            ),
    },
  );
};

const arrayElementFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly element: ESTree.ArrayExpression["elements"][number];
    readonly evaluation: ReduceEvaluation;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  if (input.element === null) return unknownCandidateSet();
  const expression =
    input.element.type === "SpreadElement" ? input.element.argument : input.element;
  if (
    input.element.type === "SpreadElement" &&
    sameBinding(resolution.environment, {
      binding: input.evaluation.bindings.accumulator,
      expression,
    })
  ) {
    return input.accumulator;
  }
  return input.element.type === "SpreadElement"
    ? canonicalValueArrayReduceCollectionFacts(resolution, {
        expression,
        query: input.evaluation.query,
      })
    : scalarFacts(resolution, { evaluation: input.evaluation, expression });
};

const arrayExpressionFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly evaluation: ReduceEvaluation;
    readonly expression: ESTree.ArrayExpression;
  },
): CandidateSet<CanonicalValueDomainFact> =>
  input.expression.elements.reduce<CandidateSet<CanonicalValueDomainFact>>(
    (facts, element) =>
      appendFacts(
        facts,
        arrayElementFacts(resolution, {
          accumulator: input.accumulator,
          element,
          evaluation: input.evaluation,
        }),
      ),
    closedCandidateSet(
      [
        {
          derivedFromRegisteredRoute: false,
          kind: "values",
          localContribution: false,
          node: input.evaluation.query.expression,
          values: [],
        },
      ],
      canonicalValueDomainFactIdentity,
    ),
  );

const returnedFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly evaluation: ReduceEvaluation;
    readonly expression: ESTree.Expression;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const expression = unwrapExpression(input.expression);
  if (
    sameBinding(resolution.environment, {
      binding: input.evaluation.bindings.accumulator,
      expression,
    })
  ) {
    return input.accumulator;
  }
  if (expression.type === "ArrayExpression") {
    return arrayExpressionFacts(resolution, { ...input, expression });
  }
  const collection = canonicalValueArrayReduceCollectionFacts(resolution, {
    expression,
    query: input.evaluation.query,
  });
  return collection.candidates.length === 0
    ? scalarFacts(resolution, { evaluation: input.evaluation, expression })
    : collection;
};

const pushMutation = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly evaluation: ReduceEvaluation;
    readonly expression: ESTree.Expression;
  },
): CandidateSet<CanonicalValueDomainFact> | null => {
  const expression = unwrapExpression(input.expression);
  if (expression.type !== "CallExpression") return null;
  const callee = unwrapExpression(expression.callee);
  if (
    callee.type !== "MemberExpression" ||
    callee.object.type === "Super" ||
    canonicalValueStaticMemberName(callee) !== "push" ||
    !sameBinding(resolution.environment, {
      binding: input.evaluation.bindings.accumulator,
      expression: callee.object,
    })
  ) {
    return null;
  }
  return expression.arguments.reduce<CandidateSet<CanonicalValueDomainFact>>(
    (accumulator, argument) => {
      const source =
        argument.type === "SpreadElement"
          ? canonicalValueArrayReduceCollectionFacts(resolution, {
              expression: argument.argument,
              query: input.evaluation.query,
            })
          : scalarFacts(resolution, { evaluation: input.evaluation, expression: argument });
      return appendFacts(accumulator, source);
    },
    input.accumulator,
  );
};

const blockCallbackFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly evaluation: ReduceEvaluation;
    readonly statements: readonly ESTree.Statement[];
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const [statement, ...remainingStatements] = input.statements;
  if (statement === undefined) return unknownCandidateSet();
  if (statement.type === "ReturnStatement") {
    return statement.argument === null
      ? unknownCandidateSet()
      : returnedFacts(resolution, {
          accumulator: input.accumulator,
          evaluation: input.evaluation,
          expression: statement.argument,
        });
  }
  const mutated =
    statement.type === "ExpressionStatement"
      ? pushMutation(resolution, {
          accumulator: input.accumulator,
          evaluation: input.evaluation,
          expression: statement.expression,
        })
      : null;
  return blockCallbackFacts(resolution, {
    accumulator:
      mutated ?? openCandidateSet(input.accumulator.candidates, canonicalValueDomainFactIdentity),
    evaluation: input.evaluation,
    statements: remainingStatements,
  });
};

export const canonicalValueArrayReduceCallbackFacts = (
  resolution: CanonicalValueCollectionResolution,
  input: {
    readonly accumulator: CandidateSet<CanonicalValueDomainFact>;
    readonly callback: ReduceCallback;
    readonly evaluation: Omit<ReduceEvaluation, "bindings">;
  },
): CandidateSet<CanonicalValueDomainFact> => {
  const evaluation = {
    ...input.evaluation,
    bindings: callbackBindings(resolution.environment, input.callback),
  };
  const body = input.callback.functionNode.body;
  if (body === null) return unknownCandidateSet();
  return body.type === "BlockStatement"
    ? blockCallbackFacts(resolution, {
        accumulator: input.accumulator,
        evaluation,
        statements: body.body,
      })
    : returnedFacts(resolution, {
        accumulator: input.accumulator,
        evaluation,
        expression: body,
      });
};
