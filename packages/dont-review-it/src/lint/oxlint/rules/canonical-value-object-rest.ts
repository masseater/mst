import { joinCandidateSets, type CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { canonicalValueAbsentOriginSet } from "./canonical-value-property-runtime.ts";

export const resolveCanonicalValueObjectRestProperty = (input: {
  readonly excluded: readonly CandidateSet<string>[];
  readonly propertyName: string;
  readonly resolveRetained: () => CandidateSet<CanonicalValueOrigin>;
}): CandidateSet<CanonicalValueOrigin> => {
  const canExclude = input.excluded.some((keys) => keys.candidates.includes(input.propertyName));
  const canRetain = input.excluded.every(
    (keys) => !keys.complete || keys.candidates.some((key) => key !== input.propertyName),
  );
  const origins = joinCandidateSets(
    [
      ...(canExclude ? [canonicalValueAbsentOriginSet()] : []),
      ...(canRetain ? [input.resolveRetained()] : []),
    ],
    canonicalValueOriginKey,
  );
  return input.excluded.every((keys) => keys.complete) ? origins : { ...origins, complete: false };
};
