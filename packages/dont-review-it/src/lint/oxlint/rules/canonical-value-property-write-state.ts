import { flatMap, uniq } from "es-toolkit";

import {
  filterCandidateSet,
  joinCandidateSets,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueCallArgumentsHaveKnownWidths,
  canonicalValueCallArgumentSources,
} from "./canonical-value-call-arguments.ts";
import { resolveCanonicalValueObjectRestProperty } from "./canonical-value-object-rest.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import {
  appendCanonicalValueProjection,
  type CanonicalValueBindingResolutionInput as BindingResolutionInput,
  type CanonicalValuePropertyInternals,
  type CanonicalValueWriteResolutionInput as WriteResolutionInput,
} from "./canonical-value-property-runtime.ts";
import {
  resolveCanonicalValueBindingWriteOrigin,
  type CanonicalValueWriteSourceResolver,
} from "./canonical-value-property-write-event.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueIndexedPropertyPath,
  CanonicalValueSourcePath,
} from "./canonical-value-binding-index.ts";

const sourcePropertyKeys = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & { readonly propertyKey: CanonicalValueIndexedPropertyPath[number] },
): CandidateSet<string> =>
  state.staticResolver.propertyKeys(input.propertyKey, {
    cutoff: input.cutoff,
    executionContext: input.executionContext,
  });

const resolveObjectRest = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & {
    readonly segment: Extract<CanonicalValueSourcePath[number], { readonly kind: "object-rest" }>;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const excluded = input.segment.excludedKeys.map((propertyKey) =>
    sourcePropertyKeys(state, { ...input, propertyKey }),
  );
  const [first, ...remaining] = input.targetPath;
  if (typeof first === "string") {
    return resolveCanonicalValueObjectRestProperty({
      excluded,
      propertyName: first,
      resolveRetained: () =>
        resolveSourcePath(state, {
          ...input,
          prefix: [...input.prefix, first],
          targetPath: remaining,
        }),
    });
  }
  if (excluded.some((keys) => !keys.complete)) return unknownCandidateSet();
  const excludedKeys = uniq(flatMap(excluded, (keys) => keys.candidates));
  const origins = input.resolve(state, { ...input, path: input.prefix });
  return appendCanonicalValueProjection(origins, { excludedKeys, kind: "object-rest" });
};

const resolveArrayRest = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & { readonly startIndex: number },
): CandidateSet<CanonicalValueOrigin> => {
  const [first, ...remaining] = input.targetPath;
  const index = typeof first === "string" ? canonicalValueArrayIndexOf(first) : null;
  if (index !== null) {
    return resolveSourcePath(state, {
      ...input,
      prefix: [...input.prefix, String(input.startIndex + index)],
      targetPath: remaining,
    });
  }
  const origins = input.resolve(state, { ...input, path: input.prefix });
  const sliced = appendCanonicalValueProjection(origins, {
    kind: "array-slice",
    startIndex: input.startIndex,
  });
  return input.targetPath.length === 0
    ? sliced
    : appendCanonicalValueProjection(sliced, { kind: "property", path: input.targetPath });
};

const defaultOriginUse = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & { readonly origin: CanonicalValueOrigin },
): { readonly fallback: boolean; readonly retain: boolean } => {
  if (input.origin.kind === "absent") return { fallback: true, retain: false };
  if (input.origin.projections.length !== 0) return { fallback: true, retain: true };
  const primitives = state.staticResolver.primitives({
    cutoff: input.cutoff,
    executionContext: input.executionContext,
    expression: input.origin.expression,
  });
  if (primitives.complete && primitives.candidates.length !== 0) {
    const fallback = primitives.candidates.some((primitive) => primitive === undefined);
    const retain = primitives.candidates.some((primitive) => primitive !== undefined);
    return { fallback, retain };
  }
  const condition = state.staticResolver.condition({
    cutoff: input.cutoff,
    executionContext: input.executionContext,
    expression: input.origin.expression,
  });
  return condition !== null && !condition.nullish
    ? { fallback: false, retain: true }
    : { fallback: true, retain: true };
};

const resolveDefault = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & { readonly fallback: ESTree.Expression },
): CandidateSet<CanonicalValueOrigin> => {
  const primary = resolveSourcePath(state, input);
  const uses = primary.candidates.map((origin) => ({
    origin,
    ...defaultOriginUse(state, { ...input, origin }),
  }));
  const canUseFallback = !primary.complete || uses.some((use) => use.fallback);
  if (!canUseFallback) return primary;
  const retained = {
    candidates: uses.filter((use) => use.retain).map((use) => use.origin),
    complete: primary.complete,
  };
  const fallbackOrigins = input.resolve(state, {
    ...input,
    cutoff: input.fallback.start,
    executionContext: state.bindingIndex.executionContextAt(input.fallback),
    expression: input.fallback,
    path: input.targetPath,
  });
  return joinCandidateSets(
    [filterCandidateSet(retained, (origin) => origin.kind !== "absent"), fallbackOrigins],
    canonicalValueOriginKey,
  );
};

type CallRestInput = WriteResolutionInput & {
  readonly segment: Extract<CanonicalValueSourcePath[number], { readonly kind: "call-rest" }>;
};

const completeCallArgumentOrigins = (input: {
  readonly origins: CandidateSet<CanonicalValueOrigin>;
  readonly segments: CallRestInput["segment"]["segments"];
}): CandidateSet<CanonicalValueOrigin> =>
  canonicalValueCallArgumentsHaveKnownWidths(input.segments)
    ? input.origins
    : { ...input.origins, complete: false };

const resolveCallRestIndex = (
  state: CanonicalValuePropertyInternals,
  input: CallRestInput & {
    readonly index: number;
    readonly remainingSourcePath: CanonicalValueSourcePath;
    readonly targetPath: WriteResolutionInput["targetPath"];
  },
): CandidateSet<CanonicalValueOrigin> => {
  const sources = canonicalValueCallArgumentSources(
    input.segment.segments,
    input.segment.startIndex + input.index,
  );
  const origins = joinCandidateSets(
    sources.map((source) =>
      resolveSourcePath(state, {
        ...input,
        cutoff: source.expression.start,
        executionContext: state.bindingIndex.executionContextAt(source.expression),
        expression: source.expression,
        prefix: [],
        sourcePath: [...source.sourcePath, ...input.remainingSourcePath],
        targetPath: input.targetPath,
      }),
    ),
    canonicalValueOriginKey,
  );
  return completeCallArgumentOrigins({ origins, segments: input.segment.segments });
};

const resolveNestedCallRest = (
  state: CanonicalValuePropertyInternals,
  input: CallRestInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  const [sourceSegment, ...remainingSourcePath] = input.sourcePath;
  if (sourceSegment?.kind === "array-index") {
    return resolveCallRestIndex(state, {
      ...input,
      index: sourceSegment.index,
      remainingSourcePath,
      targetPath: input.targetPath,
    });
  }
  if (sourceSegment?.kind === "array-rest") {
    return resolveCallRest(state, {
      ...input,
      segment: {
        ...input.segment,
        startIndex: input.segment.startIndex + sourceSegment.startIndex,
      },
      sourcePath: remainingSourcePath,
    });
  }
  return sourceSegment === undefined ? null : unknownCandidateSet();
};

const resolveCallRestTarget = (
  state: CanonicalValuePropertyInternals,
  input: CallRestInput,
): CandidateSet<CanonicalValueOrigin> => {
  const [first, ...remaining] = input.targetPath;
  if (first === undefined) {
    return appendCanonicalValueProjection(input.resolve(state, { ...input, path: [] }), {
      kind: "call-arguments",
      segments: input.segment.segments,
      startIndex: input.segment.startIndex,
    });
  }
  const index = typeof first === "string" ? canonicalValueArrayIndexOf(first) : null;
  if (index === null) return unknownCandidateSet();
  return resolveCallRestIndex(state, {
    ...input,
    index,
    remainingSourcePath: [],
    targetPath: remaining,
  });
};

const resolveCallRest = (
  state: CanonicalValuePropertyInternals,
  input: CallRestInput,
): CandidateSet<CanonicalValueOrigin> => {
  const nested = resolveNestedCallRest(state, input);
  return nested ?? resolveCallRestTarget(state, input);
};

const resolveSourceProperty = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & {
    readonly propertyKey: CanonicalValueIndexedPropertyPath[number];
  },
): CandidateSet<CanonicalValueOrigin> => {
  const keys = sourcePropertyKeys(state, input);
  const origins = joinCandidateSets(
    keys.candidates.map((key) =>
      resolveSourcePath(state, { ...input, prefix: [...input.prefix, key] }),
    ),
    canonicalValueOriginKey,
  );
  return keys.complete ? origins : { ...origins, complete: false };
};

const projectedSourcePath = (
  segment: CanonicalValueSourcePath[number],
): CanonicalValueOriginProjection | null => {
  if (segment.kind === "static-values") return segment;
  return segment.kind === "array-element" || segment.kind === "property-name"
    ? { kind: segment.kind }
    : null;
};

const resolveProjectedSourcePath = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & {
    readonly projection: CanonicalValueOriginProjection;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const origins = appendCanonicalValueProjection(
    input.resolve(state, { ...input, path: input.prefix }),
    input.projection,
  );
  return input.targetPath.length === 0
    ? origins
    : appendCanonicalValueProjection(origins, {
        kind: "property",
        path: input.targetPath,
      });
};

const resolveSpecialSourcePath = (
  state: CanonicalValuePropertyInternals,
  input: WriteResolutionInput & {
    readonly segment: Exclude<
      CanonicalValueSourcePath[number],
      | { readonly kind: "array-index" }
      | { readonly kind: "call-rest" }
      | { readonly kind: "property" }
    >;
  },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.segment.kind === "unknown") return unknownCandidateSet();
  const projection = projectedSourcePath(input.segment);
  if (projection !== null) return resolveProjectedSourcePath(state, { ...input, projection });
  if (input.segment.kind === "array-rest") {
    return resolveArrayRest(state, { ...input, startIndex: input.segment.startIndex });
  }
  if (input.segment.kind === "object-rest") {
    return resolveObjectRest(state, { ...input, segment: input.segment });
  }
  return input.segment.kind === "default"
    ? resolveDefault(state, { ...input, fallback: input.segment.expression })
    : unknownCandidateSet();
};

const resolveSourcePath: CanonicalValueWriteSourceResolver = (
  state,
  input,
): CandidateSet<CanonicalValueOrigin> => {
  const [segment, ...remaining] = input.sourcePath;
  if (segment === undefined) {
    return input.resolve(state, { ...input, path: [...input.prefix, ...input.targetPath] });
  }
  const next = { ...input, sourcePath: remaining };
  if (segment.kind === "array-index") {
    return resolveSourcePath(state, { ...next, prefix: [...input.prefix, String(segment.index)] });
  }
  if (segment.kind === "call-rest") {
    return resolveCallRest(state, { ...next, segment });
  }
  return segment.kind === "property"
    ? resolveSourceProperty(state, { ...next, propertyKey: segment.key })
    : resolveSpecialSourcePath(state, { ...next, segment });
};

export const resolveCanonicalValueBindingOrigin = (
  state: CanonicalValuePropertyInternals,
  input: BindingResolutionInput,
): CandidateSet<CanonicalValueOrigin> =>
  resolveCanonicalValueBindingWriteOrigin(state, { ...input, resolveSourcePath });
