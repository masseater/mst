import type { ESTree, SourceCode } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueTypeAliasIndex } from "./canonical-value-type-alias.ts";

export type CanonicalValuePrimitiveTypeEnvironment = {
  readonly aliases: CanonicalValueTypeAliasIndex;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly sourceCode: Pick<SourceCode, "getScope">;
};

export type CanonicalValuePrimitiveTypeResolution = {
  readonly seenTypes: ReadonlySet<ESTree.TSType>;
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
  readonly type: ESTree.TSType;
};

export type CanonicalValuePrimitiveTypeResolver = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution,
) => CandidateSet<CanonicalValue> | null;
