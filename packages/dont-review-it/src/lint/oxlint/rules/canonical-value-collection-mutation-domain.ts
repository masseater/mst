import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  type CanonicalValue,
} from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { commonCanonicalValueRegisteredEntry } from "./canonical-value-route-domain.ts";

import type { ESTree } from "@oxlint/plugins";
import type { PropertyPathInput } from "../lib/canonical-values/property-path.ts";
import type { CanonicalValueExecutionContext } from "./canonical-value-binding-index.ts";
import type {
  MutationFact,
  MutationGroup,
  MutationState,
  CanonicalValueCollectionMutationSinkEnvironment,
} from "./canonical-value-collection-mutation-types.ts";
import type { CanonicalValueDomainFact } from "./canonical-value-domain.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueRecognizedInvocation,
} from "./canonical-value-invocation.ts";

export const mutationFactKey = (fact: MutationFact): string =>
  fact.kind === "unregistered"
    ? `unregistered:${fact.specifier}:${fact.importedName}:${fact.node.start}:${fact.node.end}`
    : `values:${fingerprintValues(fact.values)}:${String(fact.localContribution)}:${String(fact.derivedFromRegisteredRoute)}:${String(fact.catalogBindingContribution === true)}`;

export const mutationStateKey = (state: MutationState): string =>
  state.kind === "unregistered"
    ? mutationFactKey(state)
    : `${mutationFactKey(state)}:${fingerprintValues(state.baselineValues)}:${String(state.baselineLocalContribution)}:${String(state.mutationContribution)}:${String(state.reportSingleton)}`;

const valueFact = (input: {
  readonly catalogBindingContribution?: boolean;
  readonly canonicalItems: readonly CanonicalValue[];
  readonly derivedFromRegisteredRoute: boolean;
  readonly localContribution: boolean;
  readonly node: ESTree.Span;
}): Extract<MutationFact, { readonly kind: "values" }> => ({
  catalogBindingContribution: input.catalogBindingContribution,
  derivedFromRegisteredRoute: input.derivedFromRegisteredRoute,
  kind: "values",
  localContribution: input.localContribution,
  node: input.node,
  values: input.canonicalItems,
});

const emptyValueFact = (node: ESTree.Span): MutationFact =>
  valueFact({
    canonicalItems: [],
    derivedFromRegisteredRoute: false,
    localContribution: false,
    node,
  });

const normalizeDomainFact = (
  fact: CanonicalValueDomainFact,
  node: ESTree.Span,
): CandidateSet<MutationFact> => {
  if (fact.kind === "unregistered") return closedCandidateSet([fact], mutationFactKey);
  if (fact.kind === "external") return unknownCandidateSet();
  if (fact.kind === "values") {
    return closedCandidateSet([{ ...fact, node }], mutationFactKey);
  }
  const entry = commonCanonicalValueRegisteredEntry(fact.entries);
  return entry === null
    ? unknownCandidateSet()
    : closedCandidateSet(
        [
          valueFact({
            canonicalItems: entry.values,
            derivedFromRegisteredRoute: true,
            localContribution: false,
            node,
          }),
        ],
        mutationFactKey,
      );
};

const normalizeDomain = (
  candidates: CandidateSet<CanonicalValueDomainFact>,
  node: ESTree.Span,
): CandidateSet<MutationFact> =>
  flatMapCandidateSet(candidates, {
    candidateKey: mutationFactKey,
    mapCandidate: (fact) => normalizeDomainFact(fact, node),
  });

const sourcePath = (origin: CanonicalValueExpressionOrigin): readonly PropertyPathInput[] =>
  origin.projections.flatMap((projection) =>
    projection.kind === "property" ? projection.path : [],
  );

const canonicalPrimitives = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly node: ESTree.Node;
    readonly origin: CanonicalValueExpressionOrigin;
  },
): CandidateSet<CanonicalValue> => {
  if (!input.origin.projections.every((projection) => projection.kind === "property")) {
    return unknownCandidateSet();
  }
  const primitives = environment.propertyState.primitives({
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: input.origin.expression,
    path: sourcePath(input.origin),
  });
  const supported = primitives.candidates.filter(
    (primitive): primitive is CanonicalValue =>
      primitive !== undefined && typeof primitive !== "bigint",
  );
  return supported.length === primitives.candidates.length
    ? { candidates: supported, complete: primitives.complete }
    : openCandidateSet(supported, canonicalValueKey);
};

const scalarFact = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origin: CanonicalValueOrigin },
): CandidateSet<MutationFact> => {
  const origin = input.origin;
  if (origin.kind === "absent") return unknownCandidateSet();
  const routed = normalizeDomain(
    environment.domain.origin({
      cutoff: input.node.start,
      executionContext: environment.bindingIndex.executionContextAt(input.node),
      origin,
    }),
    origin.expression,
  );
  const unregistered = routed.candidates.filter(
    (fact): fact is Extract<MutationFact, { readonly kind: "unregistered" }> =>
      fact.kind === "unregistered",
  );
  if (unregistered.length !== 0) {
    return { candidates: unregistered, complete: routed.complete };
  }
  const projected = routed.candidates.filter(
    (fact): fact is Extract<MutationFact, { readonly kind: "values" }> => fact.kind === "values",
  );
  if (origin.projections.length !== 0 && projected.length !== 0) {
    return { candidates: projected, complete: routed.complete };
  }
  return mapCandidateSet(canonicalPrimitives(environment, { node: input.node, origin }), {
    candidateKey: mutationFactKey,
    mapCandidate: (primitive) =>
      valueFact({
        canonicalItems: [primitive],
        derivedFromRegisteredRoute: false,
        localContribution: true,
        node: origin.expression,
      }),
  });
};

export const scalarFacts = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origins: CandidateSet<CanonicalValueOrigin> },
): CandidateSet<MutationFact> =>
  flatMapCandidateSet(input.origins, {
    candidateKey: mutationFactKey,
    mapCandidate: (origin) => scalarFact(environment, { node: input.node, origin }),
  });

const appendSourceFacts = (input: {
  readonly left: MutationFact;
  readonly node: ESTree.Span;
  readonly right: MutationFact;
}): MutationFact => {
  if (input.left.kind === "unregistered") return input.left;
  if (input.right.kind === "unregistered") return input.right;
  return valueFact({
    canonicalItems: [...input.left.values, ...input.right.values],
    catalogBindingContribution:
      input.left.catalogBindingContribution === true ||
      input.right.catalogBindingContribution === true,
    derivedFromRegisteredRoute:
      input.left.derivedFromRegisteredRoute || input.right.derivedFromRegisteredRoute,
    localContribution: input.left.localContribution || input.right.localContribution,
    node: input.node,
  });
};

const appendSource = (input: {
  readonly accumulated: CandidateSet<MutationFact>;
  readonly next: CandidateSet<MutationFact>;
  readonly node: ESTree.Span;
}): CandidateSet<MutationFact> =>
  flatMapCandidateSet(input.accumulated, {
    candidateKey: mutationFactKey,
    mapCandidate: (left) =>
      mapCandidateSet(input.next, {
        candidateKey: mutationFactKey,
        mapCandidate: (right) => appendSourceFacts({ left, node: input.node, right }),
      }),
  });

const sourceSequence = (
  sources: readonly CandidateSet<MutationFact>[],
  node: ESTree.Span,
): CandidateSet<MutationFact> =>
  sources.reduce(
    (accumulated, next) => appendSource({ accumulated, next, node }),
    closedCandidateSet([emptyValueFact(node)], mutationFactKey),
  );

const arrayExpressionWidth = (expression: ESTree.Expression): number | null => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "ArrayExpression") return null;
  return unwrapped.elements.reduce<number | null>((width, element) => {
    if (width === null) return null;
    if (element?.type !== "SpreadElement") return width + 1;
    const spreadWidth = arrayExpressionWidth(element.argument);
    return spreadWidth === null ? null : width + spreadWidth;
  }, 0);
};

const directArgumentCount = (fact: CanonicalValueInvocationFact): number | null => {
  if (!fact.argumentSegments.every((segment) => segment.kind === "direct")) return null;
  const elements = fact.argumentSegments.flatMap((segment) => segment.elements);
  return elements.reduce<number | null>((count, element) => {
    if (count === null) return null;
    if (element.type !== "SpreadElement") return count + 1;
    const spreadWidth = arrayExpressionWidth(element.argument);
    return spreadWidth === null ? null : count + spreadWidth;
  }, 0);
};

export const invocationSources = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly node: ESTree.CallExpression;
    readonly startIndex: number;
  },
): CandidateSet<MutationFact> => {
  const count = directArgumentCount(input.fact);
  if (count === null) return unknownCandidateSet();
  const sources = Array.from({ length: Math.max(0, count - input.startIndex) }, (_, offset) =>
    scalarFacts(environment, {
      node: input.node,
      origins: environment.invocationState.argumentOrigins(input.fact, input.startIndex + offset),
    }),
  );
  return sourceSequence(sources, input.node);
};

export const numericCandidates = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origins: CandidateSet<CanonicalValueOrigin> },
): CandidateSet<number> =>
  flatMapCandidateSet(input.origins, {
    candidateKey: String,
    mapCandidate: (origin) => {
      if (origin.kind === "absent") return unknownCandidateSet();
      const primitives = canonicalPrimitives(environment, { node: input.node, origin });
      return {
        candidates: primitives.candidates.map((primitive) => Number(primitive)),
        complete: primitives.complete,
      };
    },
  });

export const optionalNumericCandidates = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origins: CandidateSet<CanonicalValueOrigin> },
): CandidateSet<number | null> =>
  flatMapCandidateSet(input.origins, {
    candidateKey: String,
    mapCandidate: (origin) => {
      if (origin.kind === "absent") return closedCandidateSet([null], String);
      const primitives = canonicalPrimitives(environment, { node: input.node, origin });
      return {
        candidates: primitives.candidates.map((primitive) => Number(primitive)),
        complete: primitives.complete,
      };
    },
  });

export const receiverOrigins = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly cutoff?: number;
    readonly executionContext?: CanonicalValueExecutionContext;
    readonly expression: ESTree.Expression;
  },
): CandidateSet<CanonicalValueExpressionOrigin> =>
  flatMapCandidateSet<CanonicalValueOrigin, CanonicalValueExpressionOrigin>(
    environment.propertyState.origins(input),
    {
      candidateKey: canonicalValueOriginKey,
      mapCandidate: (origin) =>
        origin.kind === "absent"
          ? unknownCandidateSet<CanonicalValueExpressionOrigin>()
          : closedCandidateSet<CanonicalValueExpressionOrigin>([origin], canonicalValueOriginKey),
    },
  );

export const setReceiverOrigins = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  invocation: CanonicalValueRecognizedInvocation,
): CandidateSet<CanonicalValueExpressionOrigin> => {
  if (
    invocation.target.kind !== "set-add" &&
    invocation.target.kind !== "set-clear" &&
    invocation.target.kind !== "set-delete"
  ) {
    return unknownCandidateSet();
  }
  if (invocation.thisArgument === null) {
    return closedCandidateSet([invocation.target.receiver], canonicalValueOriginKey);
  }
  return flatMapCandidateSet<CanonicalValueExpressionOrigin, CanonicalValueExpressionOrigin>(
    receiverOrigins(environment, { expression: invocation.thisArgument }),
    {
      candidateKey: canonicalValueOriginKey,
      mapCandidate: (origin) => {
        if (origin.projections.length !== 0 || origin.expression.type !== "CallExpression") {
          return closedCandidateSet([origin], canonicalValueOriginKey);
        }
        return flatMapCandidateSet<
          CanonicalValueRecognizedInvocation,
          CanonicalValueExpressionOrigin
        >(environment.invocationState.recognized(origin.expression), {
          candidateKey: canonicalValueOriginKey,
          mapCandidate: (candidate) =>
            candidate.target.kind === "set-add"
              ? closedCandidateSet([candidate.target.receiver], canonicalValueOriginKey)
              : unknownCandidateSet(),
        });
      },
    },
  );
};

const setConstructorBase = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  origin: CanonicalValueExpressionOrigin,
): CandidateSet<MutationFact> | null => {
  if (origin.projections.length !== 0) return null;
  const expression = origin.expression;
  if (expression.type !== "CallExpression" && expression.type !== "NewExpression") return null;
  const recognized = environment.invocationState.recognized(expression);
  const constructors = recognized.candidates.filter(
    (invocation) => invocation.target.kind === "set-constructor",
  );
  if (constructors.length === 0) return null;
  const domains = constructors.map((invocation) =>
    flatMapCandidateSet(environment.invocationState.argumentOrigins(invocation, 0), {
      candidateKey: mutationFactKey,
      mapCandidate: (argument) =>
        argument.kind === "absent"
          ? closedCandidateSet([emptyValueFact(origin.expression)], mutationFactKey)
          : normalizeDomain(environment.domain.origin({ origin: argument }), origin.expression),
    }),
  );
  const joined = joinCandidateSets(domains, mutationFactKey);
  return recognized.complete ? joined : { ...joined, complete: false };
};

export const groupBase = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  group: MutationGroup,
): CandidateSet<MutationState> => {
  const setBase = group.set ? setConstructorBase(environment, group.origin) : null;
  const domain =
    setBase ??
    normalizeDomain(environment.domain.origin({ origin: group.origin }), group.origin.expression);
  return mapCandidateSet(domain, {
    candidateKey: mutationStateKey,
    mapCandidate: (fact) =>
      fact.kind === "unregistered"
        ? fact
        : {
            ...fact,
            baselineLocalContribution: fact.localContribution,
            baselineValues: fact.values,
            mutationContribution: false,
            reportSingleton: false,
          },
  });
};
