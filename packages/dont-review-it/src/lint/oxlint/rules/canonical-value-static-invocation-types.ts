import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";
import type { CanonicalValueStaticCallResolver } from "./canonical-value-static-query.ts";

export type CanonicalValueStaticInvocationEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
};

export type CanonicalValueStaticResolutionContext = Pick<
  Parameters<CanonicalValueStaticCallResolver>[0],
  "query" | "resolve"
>;

export type CanonicalValueStaticInvocationInput = CanonicalValueStaticResolutionContext & {
  readonly fact: CanonicalValueInvocationFact;
};
