import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueExecutionContext } from "./canonical-value-binding-index.ts";
import type { CanonicalValueStaticPrimitive } from "./canonical-value-static-primitive.ts";

export type CanonicalValueStaticQuery = {
  readonly callResolver?: CanonicalValueStaticCallResolver;
  readonly cutoff: number;
  readonly executionContext: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
};

export type CanonicalValueStaticCallResolver = (input: {
  readonly expression: ESTree.CallExpression | ESTree.TaggedTemplateExpression;
  readonly query: CanonicalValueStaticQuery;
  readonly resolve: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
}) => CandidateSet<CanonicalValueStaticPrimitive> | null;
