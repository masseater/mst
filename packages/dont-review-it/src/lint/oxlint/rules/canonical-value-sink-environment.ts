import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueDomainResolver } from "./canonical-value-domain.ts";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";
import type { CanonicalValueReporter } from "./canonical-value-report.ts";

export type CanonicalValueSinkEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly domain: CanonicalValueDomainResolver;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
  readonly reporter: CanonicalValueReporter;
};
