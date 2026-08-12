import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueEnumeratedForInSources,
  canonicalValueForOfSources,
} from "./canonical-value-binding-iteration.ts";
import {
  resolveCanonicalValueStaticLengthPrimitive,
  type CanonicalValueStaticMemberRuntime,
} from "./canonical-value-static-member.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { canonicalValueStaticRegexp } from "./canonical-value-static-regexp.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueStaticQuery } from "./canonical-value-static-query.ts";

type StaticOriginInput = {
  readonly origin: CanonicalValueOrigin;
  readonly query: Omit<CanonicalValueStaticQuery, "expression">;
};

const regexpMemberPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly expression: Extract<ESTree.Expression, { readonly type: "Literal" }>;
    readonly member: string;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (!("regex" in input.expression) || (input.member !== "source" && input.member !== "flags")) {
    return null;
  }
  if (
    !runtime.standardPathStable({
      path: ["RegExp", "prototype", input.member],
      query: input.query,
    })
  ) {
    return unknownCandidateSet();
  }
  const regexp = canonicalValueStaticRegexp(input.expression);
  return regexp === null
    ? unknownCandidateSet()
    : closedCandidateSet(
        [input.member === "source" ? regexp.source : regexp.flags],
        canonicalValueStaticPrimitiveKey,
      );
};

const namedExpressionPrimitive = (
  expression: ESTree.Expression,
  member: string,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (member !== "name") return null;
  if (expression.type !== "FunctionExpression" && expression.type !== "ClassExpression") {
    return null;
  }
  return expression.id === null
    ? unknownCandidateSet()
    : closedCandidateSet([expression.id.name], canonicalValueStaticPrimitiveKey);
};

const derivedMemberPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const [projection] = input.origin.projections;
  if (
    input.origin.projections.length !== 1 ||
    projection?.kind !== "property" ||
    projection.path.length !== 1
  ) {
    return null;
  }
  const member = projection.path[0];
  if (typeof member !== "string") return null;
  const expression = input.origin.expression;
  if (expression.type === "Literal") {
    const regexp = regexpMemberPrimitive(runtime, { ...input, expression, member });
    if (regexp !== null) return regexp;
  }
  return namedExpressionPrimitive(expression, member);
};

const lengthProjectionPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const [projection] = input.origin.projections;
  return input.origin.projections.length === 1 &&
    projection?.kind === "property" &&
    projection.path.length === 1 &&
    projection.path[0] === "length"
    ? resolveCanonicalValueStaticLengthPrimitive(runtime, {
        expression: input.origin.expression,
        query: input.query,
        seen: new Set(),
      })
    : null;
};

const iterationProjectionPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const [projection] = input.origin.projections;
  return input.origin.projections.length === 1 &&
    (projection?.kind === "array-element" || projection?.kind === "property-name")
    ? iterationPrimitives(runtime, {
        ...input,
        projectionKind: projection.kind,
      })
    : null;
};

const projectedOriginPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null =>
  derivedMemberPrimitive(runtime, input) ??
  lengthProjectionPrimitive(runtime, input) ??
  iterationProjectionPrimitive(runtime, input);

const staticValuePrimitives = (
  origin: CanonicalValueOrigin,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (origin.kind === "absent" || origin.projections.length !== 1) return null;
  const [projection] = origin.projections;
  return projection?.kind === "static-values"
    ? closedCandidateSet(projection.values, canonicalValueStaticPrimitiveKey)
    : null;
};

const iterationPrimitives = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput & {
    readonly origin: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
    readonly projectionKind: "array-element" | "property-name";
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const sources =
    input.projectionKind === "array-element"
      ? canonicalValueForOfSources({
          resolveAlias: () => [],
          source: input.origin.expression,
        })
      : canonicalValueEnumeratedForInSources({
          resolveAlias: () => [],
          source: input.origin.expression,
        });
  return flatMapCandidateSet(
    {
      candidates: sources.filter((source) => source.sourcePath.length === 0),
      complete: sources.every((source) => source.sourcePath.length === 0),
    },
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (source) =>
        runtime.resolve({
          ...input.query,
          expression: source.expression,
        }),
    },
  );
};

export const resolveCanonicalValueStaticOriginPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: StaticOriginInput,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const staticValues = staticValuePrimitives(input.origin);
  if (staticValues !== null) return staticValues;
  if (input.origin.kind === "absent") return unknownCandidateSet();
  const projected = projectedOriginPrimitive(runtime, { ...input, origin: input.origin });
  if (projected !== null) return projected;
  if (input.origin.projections.length !== 0) return unknownCandidateSet();
  return runtime.resolve({ ...input.query, expression: input.origin.expression });
};
