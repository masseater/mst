import {
  mapCandidateSet,
  type CandidateKey,
  type CandidateSet,
  unknownCandidateSet,
} from "../lib/canonical-values/candidate-set.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";
import type { CanonicalValueOriginProjection } from "./canonical-value-property-origin.ts";

type CallArgumentDomainRuntime<Fragment, Domain, Query> = {
  readonly append: (
    accumulated: CandidateSet<Fragment>,
    next: CandidateSet<Fragment>,
  ) => CandidateSet<Fragment>;
  readonly collection: (query: Query, expression: ESTree.Expression) => CandidateSet<Fragment>;
  readonly empty: () => CandidateSet<Fragment>;
  readonly fragmentKey: CandidateKey<Fragment>;
  readonly scalar: (query: Query, expression: ESTree.Expression) => CandidateSet<Fragment>;
  readonly slice: (fragment: Fragment, startIndex: number) => Fragment;
  readonly toDomain: (
    node: ESTree.Expression,
    fragments: CandidateSet<Fragment>,
  ) => CandidateSet<Domain>;
};

type CallArgumentDomainInput<Query> = {
  readonly expression: ESTree.Expression;
  readonly projection: Extract<CanonicalValueOriginProjection, { readonly kind: "call-arguments" }>;
  readonly query: Query;
};

const directArgumentFragments = <Fragment, Domain, Query>(
  runtime: CallArgumentDomainRuntime<Fragment, Domain, Query>,
  input: { readonly elements: readonly ESTree.Argument[]; readonly query: Query },
): CandidateSet<Fragment> =>
  input.elements.reduce<CandidateSet<Fragment>>(
    (accumulated, element) =>
      runtime.append(
        accumulated,
        element.type === "SpreadElement"
          ? runtime.collection(input.query, element.argument)
          : runtime.scalar(input.query, element),
      ),
    runtime.empty(),
  );

const segmentFragments = <Fragment, Domain, Query>(
  runtime: CallArgumentDomainRuntime<Fragment, Domain, Query>,
  input: { readonly query: Query; readonly segment: CanonicalValueCallArgumentSegment },
): CandidateSet<Fragment> => {
  if (input.segment.kind === "unknown") return unknownCandidateSet();
  if (input.segment.kind === "source") {
    return input.segment.sourcePath.length === 0
      ? runtime.scalar(input.query, input.segment.expression)
      : unknownCandidateSet();
  }
  return input.segment.kind === "array"
    ? runtime.collection(input.query, input.segment.expression)
    : directArgumentFragments(runtime, {
        elements: input.segment.elements,
        query: input.query,
      });
};

const argumentFragments = <Fragment, Domain, Query>(
  runtime: CallArgumentDomainRuntime<Fragment, Domain, Query>,
  input: CallArgumentDomainInput<Query>,
): CandidateSet<Fragment> => {
  const projection = skipLeadingKnownUnknownArguments({
    segments: input.projection.segments,
    startIndex: input.projection.startIndex,
  });
  const fragments = projection.segments.reduce<CandidateSet<Fragment>>(
    (accumulated, segment) =>
      runtime.append(accumulated, segmentFragments(runtime, { query: input.query, segment })),
    runtime.empty(),
  );
  return mapCandidateSet(fragments, {
    candidateKey: runtime.fragmentKey,
    mapCandidate: (fragment) => runtime.slice(fragment, projection.startIndex),
  });
};

const skipLeadingKnownUnknownArguments = (input: {
  readonly segments: readonly CanonicalValueCallArgumentSegment[];
  readonly startIndex: number;
}): {
  readonly segments: readonly CanonicalValueCallArgumentSegment[];
  readonly startIndex: number;
} => {
  const [first, ...remaining] = input.segments;
  if (first?.kind !== "unknown" || first.width === undefined || first.width > input.startIndex) {
    return input;
  }
  return skipLeadingKnownUnknownArguments({
    segments: remaining,
    startIndex: input.startIndex - first.width,
  });
};

export const resolveCanonicalValueCallArgumentDomain = <Fragment, Domain, Query>(
  runtime: CallArgumentDomainRuntime<Fragment, Domain, Query>,
  input: CallArgumentDomainInput<Query>,
): CandidateSet<Domain> => runtime.toDomain(input.expression, argumentFragments(runtime, input));
