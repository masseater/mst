import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { popCanonicalValueInvocationProperty } from "./canonical-value-invocation-normalization.ts";
import {
  appendCanonicalValueOriginProjection,
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { PropertyPathInput } from "../lib/canonical-values/property-path.ts";
import type { CanonicalValueCollectionMutationSinkEnvironment } from "./canonical-value-collection-mutation-types.ts";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";

export type CanonicalValueStandardPropertyMutationFact = {
  readonly keys: CandidateSet<string>;
} & (
  | { readonly operation: "delete" | "opaque" }
  | {
      readonly operation: "write";
      readonly valueOrigins: CandidateSet<CanonicalValueOrigin>;
    }
);

type PropertyMutationResolver = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly fact: CanonicalValueInvocationFact; readonly node: ESTree.CallExpression },
) => readonly CanonicalValueStandardPropertyMutationFact[];

const propertyPath = (
  origin: CanonicalValueExpressionOrigin,
): readonly PropertyPathInput[] | null =>
  origin.projections.every((projection) => projection.kind === "property")
    ? origin.projections.flatMap((projection) => projection.path)
    : null;

const originPrimitives = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origin: CanonicalValueOrigin },
): CandidateSet<CanonicalValue> => {
  if (input.origin.kind === "absent") return unknownCandidateSet();
  const path = propertyPath(input.origin);
  if (path === null) return unknownCandidateSet();
  const primitives = environment.propertyState.primitives({
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: input.origin.expression,
    path,
  });
  const canonicalItems = primitives.candidates.filter(
    (primitive): primitive is CanonicalValue =>
      primitive !== undefined && typeof primitive !== "bigint",
  );
  return {
    candidates: canonicalItems,
    complete: primitives.complete && canonicalItems.length === primitives.candidates.length,
  };
};

const propertyKeys = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly node: ESTree.Node; readonly origins: CandidateSet<CanonicalValueOrigin> },
): CandidateSet<string> =>
  flatMapCandidateSet(input.origins, {
    candidateKey: String,
    mapCandidate: (origin) =>
      mapCandidateSet(originPrimitives(environment, { node: input.node, origin }), {
        candidateKey: String,
        mapCandidate: String,
      }),
  });

const sourceObjectKeys = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<string> =>
  flatMapCandidateSet(origins, {
    candidateKey: String,
    mapCandidate: (origin) => {
      if (origin.kind === "absent") return unknownCandidateSet();
      return flatMapCandidateSet(environment.domain.propertyNames({ kind: "expression", origin }), {
        candidateKey: String,
        mapCandidate: (fact) =>
          fact.kind === "values"
            ? closedCandidateSet(fact.values.map(String), String)
            : unknownCandidateSet(),
      });
    },
  });

const globalIdentifier = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly expression: ESTree.Expression; readonly name: string },
): boolean => {
  const expression = unwrapExpression(input.expression);
  if (expression.type !== "Identifier" || expression.name !== input.name) return false;
  const binding = environment.bindingIndex.resolveIdentifier(expression);
  return binding === null || environment.bindingIndex.definitionsOf(binding).length === 0;
};

const globalBuiltin = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly name: string; readonly origin: CanonicalValueExpressionOrigin },
): boolean => {
  const path = propertyPath(input.origin);
  if (path === null) return false;
  if (path.length === 0) {
    return globalIdentifier(environment, { expression: input.origin.expression, name: input.name });
  }
  return (
    path.length === 1 &&
    path[0] === input.name &&
    globalIdentifier(environment, { expression: input.origin.expression, name: "globalThis" })
  );
};

const projectedOrigins = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly origins: CandidateSet<CanonicalValueOrigin>; readonly property: string },
): CandidateSet<CanonicalValueOrigin> =>
  flatMapCandidateSet(input.origins, {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (origin) => {
      if (origin.kind === "absent") {
        return closedCandidateSet([origin], canonicalValueOriginKey);
      }
      const path = propertyPath(origin);
      return path === null
        ? closedCandidateSet(
            [
              appendCanonicalValueOriginProjection(origin, {
                kind: "property",
                path: [input.property],
              }),
            ],
            canonicalValueOriginKey,
          )
        : environment.propertyState.origins({
            expression: origin.expression,
            path: [...path, input.property],
          });
    },
  });

const directPropertyMutationFacts = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly descriptor: boolean;
    readonly fact: CanonicalValueInvocationFact;
    readonly node: ESTree.CallExpression;
    readonly valueIndex: number;
  },
): readonly CanonicalValueStandardPropertyMutationFact[] => {
  const valueOrigins = environment.invocationState.argumentOrigins(input.fact, input.valueIndex);
  return [
    {
      keys: propertyKeys(environment, {
        node: input.node,
        origins: environment.invocationState.argumentOrigins(input.fact, 1),
      }),
      operation: "write",
      valueOrigins: input.descriptor
        ? projectedOrigins(environment, { origins: valueOrigins, property: "value" })
        : valueOrigins,
    },
  ];
};

const mutationsForSourceObject = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly descriptors: boolean;
    readonly node: ESTree.CallExpression;
    readonly origins: CandidateSet<CanonicalValueOrigin>;
  },
): readonly CanonicalValueStandardPropertyMutationFact[] => {
  const keys = sourceObjectKeys(environment, input.origins);
  const known = keys.candidates.map<CanonicalValueStandardPropertyMutationFact>((key) => {
    const propertyOrigins = projectedOrigins(environment, {
      origins: input.origins,
      property: key,
    });
    return {
      keys: closedCandidateSet([key], String),
      operation: "write",
      valueOrigins: input.descriptors
        ? projectedOrigins(environment, { origins: propertyOrigins, property: "value" })
        : propertyOrigins,
    };
  });
  return keys.complete ? known : [...known, { keys: unknownCandidateSet(), operation: "opaque" }];
};

const assignPropertyMutationFactsAt = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly index: number;
    readonly node: ESTree.CallExpression;
  },
): readonly CanonicalValueStandardPropertyMutationFact[] => {
  const origins = environment.invocationState.argumentOrigins(input.fact, input.index);
  if (origins.complete && origins.candidates.every((origin) => origin.kind === "absent")) return [];
  const current = mutationsForSourceObject(environment, {
    descriptors: false,
    node: input.node,
    origins,
  });
  return origins.complete
    ? [
        ...current,
        ...assignPropertyMutationFactsAt(environment, { ...input, index: input.index + 1 }),
      ]
    : current;
};

const reflectSetPropertyMutationFacts: PropertyMutationResolver = (environment, input) =>
  directPropertyMutationFacts(environment, { ...input, descriptor: false, valueIndex: 2 });

const definePropertyMutationFacts: PropertyMutationResolver = (environment, input) =>
  directPropertyMutationFacts(environment, { ...input, descriptor: true, valueIndex: 2 });

const definePropertiesMutationFacts: PropertyMutationResolver = (environment, input) => {
  const origins = environment.invocationState.argumentOrigins(input.fact, 1);
  return mutationsForSourceObject(environment, {
    descriptors: true,
    node: input.node,
    origins,
  });
};

const deletePropertyMutationFacts: PropertyMutationResolver = (environment, input) => [
  {
    keys: propertyKeys(environment, {
      node: input.node,
      origins: environment.invocationState.argumentOrigins(input.fact, 1),
    }),
    operation: "delete",
  },
];

const assignPropertyMutationFacts: PropertyMutationResolver = (environment, input) =>
  assignPropertyMutationFactsAt(environment, { ...input, index: 1 });

const mutationForBuiltin = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly builtin: string;
    readonly member: string;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly resolver: PropertyMutationResolver;
  },
): PropertyMutationResolver | null => {
  const base = popCanonicalValueInvocationProperty(input.origin, input.member);
  return base !== null && globalBuiltin(environment, { name: input.builtin, origin: base })
    ? input.resolver
    : null;
};

const standardMutation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  origin: CanonicalValueExpressionOrigin,
): PropertyMutationResolver | null =>
  mutationForBuiltin(environment, {
    builtin: "Object",
    member: "defineProperty",
    origin,
    resolver: definePropertyMutationFacts,
  }) ??
  mutationForBuiltin(environment, {
    builtin: "Object",
    member: "defineProperties",
    origin,
    resolver: definePropertiesMutationFacts,
  }) ??
  mutationForBuiltin(environment, {
    builtin: "Reflect",
    member: "defineProperty",
    origin,
    resolver: definePropertyMutationFacts,
  }) ??
  mutationForBuiltin(environment, {
    builtin: "Reflect",
    member: "deleteProperty",
    origin,
    resolver: deletePropertyMutationFacts,
  }) ??
  mutationForBuiltin(environment, {
    builtin: "Reflect",
    member: "set",
    origin,
    resolver: reflectSetPropertyMutationFacts,
  }) ??
  mutationForBuiltin(environment, {
    builtin: "Object",
    member: "assign",
    origin,
    resolver: assignPropertyMutationFacts,
  });

export const canonicalValueStandardPropertyMutationFacts = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  node: ESTree.CallExpression,
): readonly {
  readonly fact: CanonicalValueInvocationFact;
  readonly mutation: CanonicalValueStandardPropertyMutationFact;
}[] =>
  environment.invocationState.facts(node).candidates.flatMap((fact) => {
    const resolveMutation = standardMutation(environment, fact.target);
    return resolveMutation === null
      ? []
      : resolveMutation(environment, { fact, node }).map((mutation) => ({ fact, mutation }));
  });
