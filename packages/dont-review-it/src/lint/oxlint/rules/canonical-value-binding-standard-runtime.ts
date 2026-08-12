import type {
  CanonicalValueCallbackRuntime,
  CanonicalValueCallableRuntime,
  CanonicalValueIdentifierSourceResolver,
} from "./canonical-value-binding-call-types.ts";

export type CanonicalValueStandardCallRuntime = CanonicalValueCallableRuntime & {
  readonly identifierSources: CanonicalValueIdentifierSourceResolver;
};

export const canonicalValueCallbackStandardCallRuntime = (
  input: CanonicalValueCallbackRuntime,
): CanonicalValueStandardCallRuntime => ({
  ...input.runtime,
  identifierSources: input.identifierSources,
});
