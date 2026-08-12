import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { propertyKeyName, unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueStaticQuery } from "./canonical-value-static-query.ts";

export type CanonicalValueStaticMemberRuntime = {
  readonly resolve: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
  readonly resolveOrigins: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueOrigin>;
  readonly standardPathStable: (input: {
    readonly path: readonly string[];
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  }) => boolean;
};

const numberSet = (values: readonly number[]): CandidateSet<CanonicalValueStaticPrimitive> =>
  closedCandidateSet(values, canonicalValueStaticPrimitiveKey);

const slicedLength = (input: {
  readonly length: number;
  readonly origins: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>;
}): number | null =>
  input.origins.projections.reduce<number | null>(
    (length, projection) =>
      length !== null && projection.kind === "array-slice"
        ? Math.max(0, length - projection.startIndex)
        : null,
    input.length,
  );

const directArrayLength = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: {
    readonly expression: ESTree.ArrayExpression;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  input.expression.elements.reduce<CandidateSet<CanonicalValueStaticPrimitive>>(
    (lengths, element) => {
      const widths =
        element?.type === "SpreadElement"
          ? resolveCanonicalValueStaticLengthPrimitive(runtime, {
              expression: element.argument,
              query: input.query,
              seen: input.seen,
            })
          : numberSet([1]);
      return flatMapCandidateSet(lengths, {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (length) =>
          typeof length !== "number"
            ? unknownCandidateSet()
            : flatMapCandidateSet(widths, {
                candidateKey: canonicalValueStaticPrimitiveKey,
                mapCandidate: (width) =>
                  typeof width === "number" ? numberSet([length + width]) : unknownCandidateSet(),
              }),
      });
    },
    numberSet([0]),
  );

const originLength = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: {
    readonly origin: CanonicalValueOrigin;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const origin = input.origin;
  if (origin.kind === "absent") return unknownCandidateSet();
  const [staticProjection] = origin.projections;
  if (origin.projections.length === 1 && staticProjection?.kind === "static-values") {
    return numberSet([staticProjection.values.length]);
  }
  const lengths = resolveCanonicalValueStaticLengthPrimitive(runtime, {
    expression: origin.expression,
    query: input.query,
    seen: input.seen,
  });
  return flatMapCandidateSet(lengths, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (length) => {
      if (typeof length !== "number") return unknownCandidateSet();
      const projected = slicedLength({ length, origins: origin });
      return projected === null ? unknownCandidateSet() : numberSet([projected]);
    },
  });
};

const combinedLengthCandidates = (input: {
  readonly originLengths: CandidateSet<CanonicalValueStaticPrimitive>;
  readonly stringLengths: CandidateSet<CanonicalValueStaticPrimitive>;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  const lengths = joinCandidateSets(
    [input.stringLengths, input.originLengths],
    canonicalValueStaticPrimitiveKey,
  );
  return lengths.candidates.length === 0 ? unknownCandidateSet() : { ...lengths, complete: false };
};

const nonArrayLength = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const primitives = runtime.resolve({ ...input.query, expression: input.expression });
  const strings = primitives.candidates.filter(
    (primitive): primitive is string => typeof primitive === "string",
  );
  if (primitives.complete && strings.length === primitives.candidates.length) {
    return numberSet(strings.map((value) => value.length));
  }
  const originLengths = flatMapCandidateSet(
    runtime.resolveOrigins({ ...input.query, expression: input.expression }),
    {
      candidateKey: canonicalValueStaticPrimitiveKey,
      mapCandidate: (origin) =>
        originLength(runtime, { origin, query: input.query, seen: input.seen }),
    },
  );
  return combinedLengthCandidates({
    originLengths,
    stringLengths: numberSet(strings.map((value) => value.length)),
  });
};

export const resolveCanonicalValueStaticLengthPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return unknownCandidateSet();
  const seen = new Set([...input.seen, expression]);
  if (expression.type === "ArrayExpression") {
    return directArrayLength(runtime, { ...input, expression, seen });
  }
  return nonArrayLength(runtime, { expression, query: input.query, seen });
};

export const resolveCanonicalValueStaticMemberPrimitive = (
  runtime: CanonicalValueStaticMemberRuntime,
  query: CanonicalValueStaticQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (query.expression.object.type === "Super") return null;
  if (propertyKeyName(query.expression.property) !== "length") return null;
  return resolveCanonicalValueStaticLengthPrimitive(runtime, {
    expression: query.expression.object,
    query,
    seen: new Set(),
  });
};
