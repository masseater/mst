import { canonicalValueStandardPathIsStable } from "./canonical-value-standard-stability.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";

import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type {
  CanonicalValueStaticInvocationEnvironment,
  CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";

export const canonicalValueStaticGlobalTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly globalName: string;
    readonly path: readonly string[];
    readonly query: CanonicalValueStaticInvocationInput["query"];
  },
): boolean => {
  const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: input.globalName,
    origin: input.fact.target,
  });
  const matches =
    path?.length === input.path.length &&
    path.every((segment, index) => segment === input.path[index]);
  return (
    matches &&
    canonicalValueStaticStandardPathIsStable(environment, {
      path: [input.globalName, ...input.path],
      query: input.query,
    })
  );
};

export const canonicalValueStaticGlobalFunctionTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly name: string;
    readonly query: CanonicalValueStaticInvocationInput["query"];
  },
): boolean =>
  canonicalValueStaticGlobalTarget(environment, {
    ...input,
    globalName: input.name,
    path: [],
  });

export const canonicalValueStaticStandardPathIsStable = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: {
    readonly path: readonly string[];
    readonly query: CanonicalValueStaticInvocationInput["query"];
  },
): boolean =>
  canonicalValueStandardPathIsStable(
    { bindingIndex: environment.bindingIndex, execution: environment.propertyState.execution },
    { ...input.query, path: input.path },
  );
