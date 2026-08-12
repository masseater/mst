import {
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  resolveCanonicalValueStaticArrayVectors,
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";
import { resolveCanonicalValueStaticNumberInvocation } from "./canonical-value-static-number.ts";
import { resolveCanonicalValueStaticDirectObjectPredicateInvocation } from "./canonical-value-static-object-predicate-evaluation.ts";
import { resolveCanonicalValueStaticPathInvocation } from "./canonical-value-static-path.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { resolveCanonicalValueStaticStandardInvocation } from "./canonical-value-static-standard.ts";
import { resolveCanonicalValueStaticStandardStringInvocation } from "./canonical-value-static-string-standard.ts";
import { resolveCanonicalValueStaticStringInvocation } from "./canonical-value-static-string.ts";
import { resolveCanonicalValueStaticTaggedTemplate } from "./canonical-value-static-tagged-template.ts";

import type { CanonicalValueStaticCallResolver } from "./canonical-value-static-query.ts";

const STATIC_FACT_RESOLVERS: readonly ((
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
) => CandidateSet<CanonicalValueStaticPrimitive> | null)[] = [
  resolveCanonicalValueStaticStringInvocation,
  resolveCanonicalValueStaticStandardStringInvocation,
  resolveCanonicalValueStaticStandardInvocation,
  resolveCanonicalValueStaticNumberInvocation,
  resolveCanonicalValueStaticPathInvocation,
];

const isArrayJoinTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): boolean => {
  const call = input.query.expression;
  if (call.type === "CallExpression") {
    const callee = unwrapExpression(call.callee);
    if (callee.type === "MemberExpression" && canonicalValueStaticMemberName(callee) === "join") {
      return true;
    }
  }
  const origin = input.fact.target;
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path?.length === 1 && path[0] === "join") return true;
  const globalPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "Array",
    origin,
  });
  return globalPath?.length === 2 && globalPath[0] === "prototype" && globalPath[1] === "join";
};

const joinedPrimitive = (
  elements: CanonicalValueStaticPrimitiveVector,
  arguments_: CanonicalValueStaticPrimitiveVector,
): CanonicalValueStaticPrimitive => {
  const separator = arguments_.length === 0 ? "," : String(arguments_[0]);
  return elements
    .map((element) => (element === null || element === undefined ? "" : String(element)))
    .join(separator);
};

const arrayJoin = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  return flatMapCandidateSet(
    resolveCanonicalValueStaticArrayVectors(environment, {
      ...input,
      expression: input.fact.thisArgument,
      seen: new Set(),
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (elements) =>
        mapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (arguments_) => joinedPrimitive(elements, arguments_),
        }),
    },
  );
};

const factResolution = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  for (const resolver of STATIC_FACT_RESOLVERS) {
    const resolution = resolver(environment, input);
    if (resolution !== null) return resolution;
  }
  return isArrayJoinTarget(environment, input) ? arrayJoin(environment, input) : null;
};

const staticInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: Parameters<CanonicalValueStaticCallResolver>[0],
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (input.expression.type === "TaggedTemplateExpression") {
    return resolveCanonicalValueStaticTaggedTemplate(environment, {
      ...input,
      expression: input.expression,
    });
  }
  const directObjectPredicate = resolveCanonicalValueStaticDirectObjectPredicateInvocation(
    environment,
    { ...input, expression: input.expression },
  );
  if (directObjectPredicate !== null) return directObjectPredicate;
  const facts = environment.invocationState.facts(input.expression);
  const resolutions = facts.candidates
    .map((fact) => factResolution(environment, { ...input, fact }))
    .filter(
      (resolution): resolution is CandidateSet<CanonicalValueStaticPrimitive> =>
        resolution !== null,
    );
  if (resolutions.length === 0) return null;
  const joined = joinCandidateSets(resolutions, canonicalValueStaticPrimitiveKey);
  return facts.complete && resolutions.length === facts.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueStaticPrimitiveKey);
};

export const createCanonicalValueStaticCallResolver =
  (environment: CanonicalValueStaticInvocationEnvironment): CanonicalValueStaticCallResolver =>
  (input) =>
    staticInvocation(environment, input);
