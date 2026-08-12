import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValuePropertyKeyOf } from "./canonical-value-binding-index.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueAbsentOriginSet,
  canonicalValueExpressionOriginSet,
  overlayCanonicalValueOriginSets,
  type CanonicalValueOriginResolver,
  type CanonicalValuePropertyInternalQuery,
  type CanonicalValuePropertyInternals,
} from "./canonical-value-property-runtime.ts";

import type { ESTree } from "@oxlint/plugins";

type ObjectResolutionInput = CanonicalValuePropertyInternalQuery & {
  readonly expression: ESTree.ObjectExpression;
  readonly index: number;
  readonly resolve: CanonicalValueOriginResolver;
};

type ArrayResolutionInput = CanonicalValuePropertyInternalQuery & {
  readonly elementIndex: number;
  readonly expression: ESTree.ArrayExpression;
  readonly offset: number;
  readonly resolve: CanonicalValueOriginResolver;
  readonly target: number;
};

const resolveEarlierObjectProperty = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResolutionInput,
): CandidateSet<CanonicalValueOrigin> =>
  resolveObjectProperties(state, { ...input, index: input.index - 1 });

const resolveObjectSpread = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResolutionInput & { readonly spread: ESTree.SpreadElement },
): CandidateSet<CanonicalValueOrigin> => {
  const earlier = () => resolveEarlierObjectProperty(state, input);
  if (state.staticResolver.emptyObjectSpread({ ...input, expression: input.spread.argument })) {
    return earlier();
  }
  return overlayCanonicalValueOriginSets(
    input.resolve(state, { ...input, expression: input.spread.argument }),
    earlier,
  );
};

const resolveObjectProperty = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResolutionInput & { readonly property: ESTree.ObjectProperty },
): CandidateSet<CanonicalValueOrigin> => {
  const [target, ...remaining] = input.path;
  if (typeof target !== "string") return unknownCandidateSet();
  const keys = state.staticResolver.propertyKeys(
    canonicalValuePropertyKeyOf(input.property.key, input.property.computed),
    { cutoff: input.property.key.start, executionContext: input.executionContext },
  );
  if (keys.complete && !keys.candidates.includes(target)) {
    return resolveEarlierObjectProperty(state, input);
  }
  const propertyOrigins = input.resolve(state, {
    ...input,
    expression: input.property.value,
    path: remaining,
  });
  if (keys.complete && keys.candidates.every((key) => key === target)) return propertyOrigins;
  const origins = joinCandidateSets(
    [propertyOrigins, resolveEarlierObjectProperty(state, input)],
    canonicalValueOriginKey,
  );
  return keys.complete
    ? origins
    : {
        candidates: origins.candidates,
        complete: false,
      };
};

const resolveObjectProperties = (
  state: CanonicalValuePropertyInternals,
  input: ObjectResolutionInput,
): CandidateSet<CanonicalValueOrigin> => {
  const property = input.expression.properties[input.index];
  if (property === undefined) return canonicalValueAbsentOriginSet();
  return property.type === "SpreadElement"
    ? resolveObjectSpread(state, { ...input, spread: property })
    : resolveObjectProperty(state, { ...input, property });
};

const arrayLengthFromOrigin = (
  state: CanonicalValuePropertyInternals,
  input: Omit<CanonicalValuePropertyInternalQuery, "path"> & {
    readonly origin: CanonicalValueOrigin;
    readonly resolve: CanonicalValueOriginResolver;
    readonly seenExpressions: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<number> => {
  if (
    input.origin.kind === "absent" ||
    input.origin.projections.some((projection) => projection.kind !== "array-slice")
  ) {
    return unknownCandidateSet();
  }
  if (input.origin.expression === input.expression) return unknownCandidateSet();
  const baseLengths = arrayLength(state, { ...input, expression: input.origin.expression });
  const startIndex = input.origin.projections.reduce(
    (offset, projection) =>
      offset + (projection.kind === "array-slice" ? projection.startIndex : 0),
    0,
  );
  return flatMapCandidateSet(baseLengths, {
    candidateKey: String,
    mapCandidate: (length) => closedCandidateSet([Math.max(0, length - startIndex)], String),
  });
};

const arrayLiteralLength = (
  state: CanonicalValuePropertyInternals,
  input: Omit<CanonicalValuePropertyInternalQuery, "path"> & {
    readonly expression: ESTree.ArrayExpression;
    readonly resolve: CanonicalValueOriginResolver;
    readonly seenExpressions: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<number> => {
  const lengths = input.expression.elements.map((element) =>
    element?.type === "SpreadElement"
      ? arrayLength(state, { ...input, expression: element.argument })
      : closedCandidateSet([1], String),
  );
  return lengths.reduce<CandidateSet<number>>(
    (totals, next) =>
      flatMapCandidateSet(totals, {
        candidateKey: String,
        mapCandidate: (total) =>
          flatMapCandidateSet(next, {
            candidateKey: String,
            mapCandidate: (length) => closedCandidateSet([total + length], String),
          }),
      }),
    closedCandidateSet([0], String),
  );
};

const arrayLength = (
  state: CanonicalValuePropertyInternals,
  input: Omit<CanonicalValuePropertyInternalQuery, "path"> & {
    readonly resolve: CanonicalValueOriginResolver;
    readonly seenExpressions: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<number> => {
  const expression = unwrapExpression(input.expression);
  if (input.seenExpressions.has(expression)) return unknownCandidateSet();
  const next = {
    ...input,
    expression,
    seenExpressions: new Set([...input.seenExpressions, expression]),
  };
  if (expression.type === "ArrayExpression") {
    return arrayLiteralLength(state, { ...next, expression });
  }
  return flatMapCandidateSet(input.resolve(state, { ...next, path: [] }), {
    candidateKey: String,
    mapCandidate: (origin) => arrayLengthFromOrigin(state, { ...next, origin }),
  });
};

const nextArrayElement = (
  state: CanonicalValuePropertyInternals,
  input: ArrayResolutionInput & { readonly width: number },
): CandidateSet<CanonicalValueOrigin> =>
  resolveArrayElements(state, {
    ...input,
    elementIndex: input.elementIndex + 1,
    offset: input.offset + input.width,
  });

const resolveArrayHole = (
  state: CanonicalValuePropertyInternals,
  input: ArrayResolutionInput,
): CandidateSet<CanonicalValueOrigin> =>
  input.offset === input.target
    ? canonicalValueAbsentOriginSet()
    : nextArrayElement(state, { ...input, width: 1 });

const resolveArrayExpressionElement = (
  state: CanonicalValuePropertyInternals,
  input: ArrayResolutionInput & { readonly element: ESTree.Expression },
): CandidateSet<CanonicalValueOrigin> =>
  input.offset === input.target
    ? input.resolve(state, { ...input, expression: input.element })
    : nextArrayElement(state, { ...input, width: 1 });

const singleArrayLength = (lengths: CandidateSet<number>): number | null => {
  const [length] = lengths.candidates;
  return lengths.complete &&
    length !== undefined &&
    lengths.candidates.every((candidate) => candidate === length)
    ? length
    : null;
};

const resolveArraySpread = (
  state: CanonicalValuePropertyInternals,
  input: ArrayResolutionInput & { readonly spread: ESTree.SpreadElement },
): CandidateSet<CanonicalValueOrigin> => {
  const length = singleArrayLength(
    arrayLength(state, {
      ...input,
      expression: input.spread.argument,
      seenExpressions: new Set(),
    }),
  );
  if (length === null) return unknownCandidateSet();
  if (input.target >= input.offset + length) {
    return nextArrayElement(state, { ...input, width: length });
  }
  return input.resolve(state, {
    ...input,
    expression: input.spread.argument,
    path: [String(input.target - input.offset), ...input.path],
  });
};

const resolveArrayElements = (
  state: CanonicalValuePropertyInternals,
  input: ArrayResolutionInput,
): CandidateSet<CanonicalValueOrigin> => {
  const element = input.expression.elements[input.elementIndex];
  if (element === undefined) return canonicalValueAbsentOriginSet();
  if (element === null) return resolveArrayHole(state, input);
  return element.type === "SpreadElement"
    ? resolveArraySpread(state, { ...input, spread: element })
    : resolveArrayExpressionElement(state, { ...input, element });
};

export const canonicalValueArrayIndexOf = (key: string): number | null => {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return null;
  const index = Number(key);
  return index <= 4_294_967_294 ? index : null;
};

const resolveArray = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & {
    readonly expression: ESTree.ArrayExpression;
    readonly resolve: CanonicalValueOriginResolver;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const [first, ...remaining] = input.path;
  if (first === undefined) return canonicalValueExpressionOriginSet(input.expression);
  if (typeof first !== "string") return unknownCandidateSet();
  const target = canonicalValueArrayIndexOf(first);
  return target === null
    ? canonicalValueExpressionOriginSet(input.expression, input.path)
    : resolveArrayElements(state, {
        ...input,
        elementIndex: 0,
        offset: 0,
        path: remaining,
        target,
      });
};

export const resolveCanonicalValueCollectionExpression = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & {
    readonly expression: ESTree.ArrayExpression | ESTree.ObjectExpression;
    readonly resolve: CanonicalValueOriginResolver;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const expression = input.expression;
  if (expression.type === "ArrayExpression") return resolveArray(state, { ...input, expression });
  if (input.path.length === 0) return canonicalValueExpressionOriginSet(expression);
  return resolveObjectProperties(state, {
    ...input,
    expression,
    index: expression.properties.length - 1,
  });
};
