import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueExecutionContext } from "./canonical-value-binding-types.ts";
import type { CanonicalValueFragment } from "./canonical-value-domain-fragment.ts";
import type { CanonicalValuePropertyNameEnvironment } from "./canonical-value-property-name-domain.ts";

export type CanonicalValueCollectionQuery = {
  readonly cutoff?: number;
  readonly executionContext?: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
  readonly seenExpressions: ReadonlySet<ESTree.Expression>;
};

export type CanonicalValueCollectionResolution = {
  readonly collectionFragments: (
    query: CanonicalValueCollectionQuery,
  ) => CandidateSet<CanonicalValueFragment>;
  readonly environment: CanonicalValuePropertyNameEnvironment;
};
