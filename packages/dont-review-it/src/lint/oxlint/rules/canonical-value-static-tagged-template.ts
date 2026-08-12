import { zip } from "es-toolkit";

import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import { type CanonicalValueStaticInvocationEnvironment } from "./canonical-value-static-invocation-types.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueStaticCallResolver } from "./canonical-value-static-query.ts";

type TaggedTemplateInput = Parameters<CanonicalValueStaticCallResolver>[0] & {
  readonly expression: ESTree.TaggedTemplateExpression;
};

const rawTemplate = (input: TaggedTemplateInput): CandidateSet<CanonicalValueStaticPrimitive> =>
  zip(input.expression.quasi.expressions, input.expression.quasi.quasis.slice(1)).reduce<
    CandidateSet<CanonicalValueStaticPrimitive>
  >(
    (prefixes, [substitution, quasi]) =>
      flatMapCandidateSet(prefixes, {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (prefix) =>
          mapCandidateSet(input.resolve({ ...input.query, expression: substitution }), {
            candidateKey: canonicalValueStaticPrimitiveKey,
            mapCandidate: (primitive) => `${String(prefix)}${String(primitive)}${quasi.value.raw}`,
          }),
      }),
    closedCandidateSet(
      [input.expression.quasi.quasis[0]?.value.raw ?? ""],
      canonicalValueStaticPrimitiveKey,
    ),
  );

const isStringRawTag = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: TaggedTemplateInput,
): { readonly complete: boolean; readonly recognized: boolean } => {
  const origins = environment.propertyState.origins({
    cutoff: input.query.cutoff,
    executionContext: input.query.executionContext,
    expression: input.expression.tag,
  });
  const recognized = origins.candidates.filter((origin) => {
    if (origin.kind === "absent") return false;
    const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name: "String",
      origin,
    });
    return path?.length === 1 && path[0] === "raw";
  }).length;
  return {
    complete: origins.complete && recognized === origins.candidates.length,
    recognized: recognized !== 0,
  };
};

export const resolveCanonicalValueStaticTaggedTemplate = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: TaggedTemplateInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const tag = isStringRawTag(environment, input);
  if (!tag.recognized) return null;
  const resolved = rawTemplate(input);
  return tag.complete
    ? resolved
    : openCandidateSet(resolved.candidates, canonicalValueStaticPrimitiveKey);
};
