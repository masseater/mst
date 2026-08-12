import { join, normalize, resolve } from "node:path";

import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueImportedRouteCallableName,
  canonicalValueImportedRouteFromOrigin,
} from "./canonical-value-route-origin.ts";
import { resolveCanonicalValueStaticInvocationArgumentVectors } from "./canonical-value-static-array.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

export const CANONICAL_VALUE_PATH_MODULE_SPECIFIERS: ReadonlySet<string> = new Set([
  "node:path",
  "path",
]);

const pathMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): string | null => {
  const route = canonicalValueImportedRouteFromOrigin(input.fact.target, environment.bindingIndex);
  if (route === null || !CANONICAL_VALUE_PATH_MODULE_SPECIFIERS.has(route.specifier)) return null;
  const method = canonicalValueImportedRouteCallableName(route);
  return method === "join" || method === "normalize" || method === "resolve" ? method : null;
};

const staticPath = (
  method: string,
  primitives: readonly CanonicalValueStaticPrimitive[],
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (!primitives.every((primitive): primitive is string => typeof primitive === "string")) {
    return unknownCandidateSet();
  }
  if (method === "normalize" && primitives.length !== 0) {
    return closedCandidateSet([normalize(primitives[0] ?? "")], canonicalValueStaticPrimitiveKey);
  }
  if (method === "normalize") return unknownCandidateSet();
  const path = method === "join" ? join(...primitives) : resolve(...primitives);
  return closedCandidateSet([path], canonicalValueStaticPrimitiveKey);
};

export const resolveCanonicalValueStaticPathInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const method = pathMethod(environment, input);
  return method === null
    ? null
    : flatMapCandidateSet(
        resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
        {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (primitives) => staticPath(method, primitives),
        },
      );
};
