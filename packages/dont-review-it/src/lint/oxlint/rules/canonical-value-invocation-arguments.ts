import { range, sumBy, uniq } from "es-toolkit";

import {
  closedCandidateSet,
  filterCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueCallArgumentParts,
  type CanonicalValueCallArgumentPart,
} from "./canonical-value-call-arguments.ts";
import {
  appendCanonicalValueOriginProjection,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import { canonicalValueAbsentOriginSet } from "./canonical-value-property-runtime.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";
import type { CanonicalValueInvocationInternals } from "./canonical-value-invocation-types.ts";

const projectedWidth = (
  width: number,
  projections: readonly CanonicalValueOriginProjection[],
): number | null => {
  if (!projections.every((projection) => projection.kind === "array-slice")) return null;
  const offset = sumBy(projections, (projection) => projection.startIndex);
  return Math.max(0, width - offset);
};

const widthFromOrigin = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueOrigin,
): CandidateSet<number> => {
  if (origin.kind === "absent" || origin.expression.type !== "ArrayExpression") {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(arrayLiteralWidths(state, origin.expression), {
    candidateKey: String,
    mapCandidate: (width) => {
      const projected = projectedWidth(width, origin.projections);
      return projected === null ? unknownCandidateSet() : closedCandidateSet([projected], String);
    },
  });
};

const elementWidths = (
  state: CanonicalValueInvocationInternals,
  element: ESTree.ArrayExpression["elements"][number],
): CandidateSet<number> =>
  element?.type === "SpreadElement"
    ? arrayWidths(state, element.argument)
    : closedCandidateSet([1], String);

const widthsFromIndex = (
  state: CanonicalValueInvocationInternals,
  input: { readonly elements: ESTree.ArrayExpression["elements"]; readonly index: number },
): CandidateSet<number> => {
  const element = input.elements[input.index];
  if (element === undefined) return closedCandidateSet([0], String);
  return flatMapCandidateSet(elementWidths(state, element), {
    candidateKey: String,
    mapCandidate: (width) =>
      flatMapCandidateSet(
        widthsFromIndex(state, { elements: input.elements, index: input.index + 1 }),
        {
          candidateKey: String,
          mapCandidate: (remaining) => closedCandidateSet([width + remaining], String),
        },
      ),
  });
};

const arrayLiteralWidths = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.ArrayExpression,
): CandidateSet<number> => widthsFromIndex(state, { elements: expression.elements, index: 0 });

const uncachedArrayWidths = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<number> =>
  flatMapCandidateSet(state.propertyState.origins({ expression }), {
    candidateKey: String,
    mapCandidate: (origin) => widthFromOrigin(state, origin),
  });

const arrayWidths = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<number> => {
  const entry = state.argumentWidthMemo.enter({
    cutoff: expression.start,
    domain: "argument-width",
    executionContext: state.bindingIndex.executionContextAt(expression),
    identity: expression,
    path: [],
  });
  if (entry.kind === "cycle") return unknownCandidateSet();
  if (entry.kind === "cached") return entry.value;
  const widths = uncachedArrayWidths(state, expression);
  entry.complete(widths);
  return widths;
};

const possibleWidths = (widths: CandidateSet<number>, index: number): readonly number[] =>
  uniq([
    ...widths.candidates.filter((width) => width <= index),
    ...(!widths.complete ? range(0, index + 1) : []),
  ]);

const argumentPartWidth = (
  state: CanonicalValueInvocationInternals,
  part: CanonicalValueCallArgumentPart,
): CandidateSet<number> => {
  if (part.kind === "one") return closedCandidateSet([1], String);
  if (part.kind === "many") return arrayWidths(state, part.expression);
  return part.width === null ? unknownCandidateSet() : closedCandidateSet([part.width], String);
};

const argumentWidthsFromParts = (
  state: CanonicalValueInvocationInternals,
  parts: readonly CanonicalValueCallArgumentPart[],
): CandidateSet<number> => {
  const [part, ...remaining] = parts;
  if (part === undefined) return closedCandidateSet([0], String);
  return flatMapCandidateSet(argumentPartWidth(state, part), {
    candidateKey: String,
    mapCandidate: (width) =>
      flatMapCandidateSet(argumentWidthsFromParts(state, remaining), {
        candidateKey: String,
        mapCandidate: (rest) => closedCandidateSet([width + rest], String),
      }),
  });
};

const isImplicitArgumentsOrigin = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueOrigin,
): origin is Exclude<CanonicalValueOrigin, { readonly kind: "absent" }> & {
  readonly expression: ESTree.IdentifierReference;
} => {
  if (
    origin.kind === "absent" ||
    origin.projections.length !== 0 ||
    origin.expression.type !== "Identifier" ||
    origin.expression.name !== "arguments"
  ) {
    return false;
  }
  const binding = state.bindingIndex.resolveIdentifier(origin.expression);
  return binding?.name === "arguments" && binding.defs.length === 0;
};

const implicitArguments = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): {
  readonly complete: boolean;
  readonly segments: readonly (readonly CanonicalValueCallArgumentSegment[])[];
} | null => {
  const origins = state.propertyState.origins({ expression });
  const implicit = origins.candidates.filter((origin) => isImplicitArgumentsOrigin(state, origin));
  if (implicit.length === 0) return null;
  return {
    complete:
      origins.complete &&
      origins.candidates.every((origin) => isImplicitArgumentsOrigin(state, origin)),
    segments: implicit.flatMap((origin) =>
      state.bindingIndex
        .callArgumentOccurrencesOf(origin.expression)
        .map((occurrence) => occurrence.argumentSegments),
    ),
  };
};

const implicitArgumentOrigins = (
  state: CanonicalValueInvocationInternals,
  input: { readonly expression: ESTree.Expression; readonly index: number },
): CandidateSet<CanonicalValueOrigin> | null => {
  const implicit = implicitArguments(state, input.expression);
  if (implicit === null) return null;
  const origins = joinCandidateSets(
    implicit.segments.map((segments) =>
      resolveArgumentParts(state, {
        index: input.index,
        parts: canonicalValueCallArgumentParts(segments),
      }),
    ),
    canonicalValueOriginKey,
  );
  return implicit.complete ? origins : { ...origins, complete: false };
};

const implicitArgumentWidths = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<number> | null => {
  const implicit = implicitArguments(state, expression);
  if (implicit === null) return null;
  const widths = joinCandidateSets(
    implicit.segments.map((segments) =>
      argumentWidthsFromParts(state, canonicalValueCallArgumentParts(segments)),
    ),
    String,
  );
  return implicit.complete ? widths : { ...widths, complete: false };
};

const resolveUnknownPart = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly index: number;
    readonly part: Extract<CanonicalValueCallArgumentPart, { readonly kind: "unknown" }>;
    readonly rest: readonly CanonicalValueCallArgumentPart[];
  },
): CandidateSet<CanonicalValueOrigin> => {
  const widths =
    input.part.width === null
      ? range(0, input.index + 1)
      : input.part.width <= input.index
        ? [input.part.width]
        : [];
  const continuations = widths.map((width) =>
    resolveArgumentParts(state, { index: input.index - width, parts: input.rest }),
  );
  return { ...joinCandidateSets(continuations, canonicalValueOriginKey), complete: false };
};

const resolveManyPart = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly expression: ESTree.Expression;
    readonly index: number;
    readonly rest: readonly CanonicalValueCallArgumentPart[];
  },
): CandidateSet<CanonicalValueOrigin> => {
  const current =
    implicitArgumentOrigins(state, input) ??
    filterCandidateSet(
      state.propertyState.origins({ expression: input.expression, path: [String(input.index)] }),
      (origin) => origin.kind !== "absent",
    );
  const widths =
    implicitArgumentWidths(state, input.expression) ?? arrayWidths(state, input.expression);
  const continuations = possibleWidths(widths, input.index).map((width) =>
    resolveArgumentParts(state, { index: input.index - width, parts: input.rest }),
  );
  const joined = joinCandidateSets([current, ...continuations], canonicalValueOriginKey);
  return current.complete && widths.complete ? joined : { ...joined, complete: false };
};

const resolveArgumentParts = (
  state: CanonicalValueInvocationInternals,
  input: { readonly index: number; readonly parts: readonly CanonicalValueCallArgumentPart[] },
): CandidateSet<CanonicalValueOrigin> => {
  const [part, ...rest] = input.parts;
  if (part === undefined) return canonicalValueAbsentOriginSet();
  if (part.kind === "many") return resolveManyPart(state, { ...input, ...part, rest });
  if (part.kind === "unknown") return resolveUnknownPart(state, { ...input, part, rest });
  return input.index === 0
    ? part.sourcePath.reduce(
        (origins, segment) => {
          if (
            segment.kind !== "array-element" &&
            segment.kind !== "property-name" &&
            segment.kind !== "static-values"
          ) {
            return unknownCandidateSet();
          }
          return mapCandidateSet(origins, {
            candidateKey: canonicalValueOriginKey,
            mapCandidate: (origin) => appendCanonicalValueOriginProjection(origin, segment),
          });
        },
        state.propertyState.origins({ expression: part.expression }),
      )
    : resolveArgumentParts(state, { index: input.index - 1, parts: rest });
};

export const resolveCanonicalValueInvocationArgumentOrigins = (
  state: CanonicalValueInvocationInternals,
  input: {
    readonly index: number;
    readonly segments: readonly CanonicalValueCallArgumentSegment[];
  },
): CandidateSet<CanonicalValueOrigin> =>
  Number.isSafeInteger(input.index) && input.index >= 0
    ? resolveArgumentParts(state, {
        index: input.index,
        parts: canonicalValueCallArgumentParts(input.segments),
      })
    : unknownCandidateSet();
