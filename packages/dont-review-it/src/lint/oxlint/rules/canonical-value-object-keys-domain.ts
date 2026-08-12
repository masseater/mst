import {
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import {
  resolveCanonicalValuePropertyNameOriginsDomain,
  type CanonicalValuePropertyNameEnvironment,
} from "./canonical-value-property-name-domain.ts";
import { type CanonicalValueOrigin } from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation.ts";

type ObjectKeysEnvironment = CanonicalValuePropertyNameEnvironment & {
  readonly invocationState: CanonicalValueInvocationState;
};

const propertyPath = (origin: CanonicalValueOrigin): readonly string[] | null => {
  if (origin.kind === "absent") return null;
  if (!origin.projections.every((projection) => projection.kind === "property")) return null;
  const path = origin.projections.flatMap((projection) => projection.path);
  return path.every((segment): segment is string => typeof segment === "string") ? path : null;
};

const globalIdentifier = (
  environment: ObjectKeysEnvironment,
  input: { readonly expression: ESTree.Expression; readonly name: string },
): boolean => {
  if (input.expression.type !== "Identifier" || input.expression.name !== input.name) return false;
  const binding = environment.bindingIndex.resolveIdentifier(input.expression);
  return binding === null || environment.bindingIndex.definitionsOf(binding).length === 0;
};

const objectKeysTarget = (
  environment: ObjectKeysEnvironment,
  fact: CanonicalValueInvocationFact,
): boolean => {
  const path = propertyPath(fact.target);
  if (path === null) return false;
  if (path.length === 1 && path[0] === "keys") {
    return globalIdentifier(environment, {
      expression: fact.target.expression,
      name: "Object",
    });
  }
  return (
    path.length === 2 &&
    path[0] === "Object" &&
    path[1] === "keys" &&
    globalIdentifier(environment, {
      expression: fact.target.expression,
      name: "globalThis",
    })
  );
};

const objectKeysFactDomain = (
  environment: ObjectKeysEnvironment,
  fact: CanonicalValueInvocationFact,
): CandidateSet<CanonicalValueDomainFact> =>
  resolveCanonicalValuePropertyNameOriginsDomain(environment, {
    keySemantics: "object-keys",
    origins: environment.invocationState.argumentOrigins(fact, 0),
  });

export const resolveCanonicalValueObjectKeysDomain = (
  environment: ObjectKeysEnvironment,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueDomainFact> | null => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "CallExpression") return null;
  const facts = environment.invocationState.facts(unwrapped);
  if (!facts.candidates.some((fact) => objectKeysTarget(environment, fact))) return null;
  return flatMapCandidateSet(facts, {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (fact) =>
      objectKeysTarget(environment, fact)
        ? objectKeysFactDomain(environment, fact)
        : unknownCandidateSet(),
  });
};
