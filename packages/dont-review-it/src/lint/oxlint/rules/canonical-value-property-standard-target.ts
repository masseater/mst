import { propertyPathsEqual } from "../lib/canonical-values/property-path.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  canonicalValueNodeExecution,
  type CanonicalValuePropertyInternals,
  type CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";
import { canonicalValueStandardPathIsStable } from "./canonical-value-standard-stability.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";

import type { CanonicalValueInvocationFact } from "./canonical-value-invocation-types.ts";

export type CanonicalValuePropertyStandardTarget = { readonly stable: boolean };

const stablePath = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueResolvedPropertyQuery & { readonly path: readonly string[] },
): boolean =>
  canonicalValueStandardPathIsStable(
    {
      bindingIndex: state.bindingIndex,
      execution: (node) => canonicalValueNodeExecution(state, node),
    },
    { cutoff: input.cutoff, executionContext: input.executionContext, path: input.path },
  );

export const canonicalValuePropertyGlobalTarget = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueResolvedPropertyQuery & {
    readonly fact: CanonicalValueInvocationFact;
    readonly globalName: string;
    readonly targetPath: readonly string[];
  },
): CanonicalValuePropertyStandardTarget | null => {
  const path = canonicalValueStaticGlobalPropertyPath(state.bindingIndex, {
    name: input.globalName,
    origin: input.fact.target,
  });
  if (path === null || !propertyPathsEqual(path, input.targetPath)) return null;
  return {
    stable: stablePath(state, {
      ...input,
      path: [input.globalName, ...input.targetPath],
    }),
  };
};

export const canonicalValuePropertyReceiverTarget = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValueResolvedPropertyQuery & {
    readonly fact: CanonicalValueInvocationFact;
    readonly globalName: "Array" | "String";
    readonly method: string;
  },
): CanonicalValuePropertyStandardTarget | null => {
  const directPath = canonicalValueInvocationPropertyPath(input.fact.target);
  const globalPath = canonicalValueStaticGlobalPropertyPath(state.bindingIndex, {
    name: input.globalName,
    origin: input.fact.target,
  });
  const matches =
    (directPath?.length === 1 && directPath[0] === input.method) ||
    (globalPath?.length === 2 && globalPath[0] === "prototype" && globalPath[1] === input.method);
  return matches
    ? {
        stable: stablePath(state, {
          ...input,
          path: [input.globalName, "prototype", input.method],
        }),
      }
    : null;
};
