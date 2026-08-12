import { flatMap, uniqBy } from "es-toolkit";

export type CandidateSet<Candidate> = {
  readonly candidates: readonly Candidate[];
  readonly complete: boolean;
};

export type CandidateKey<Candidate> = (candidate: Candidate) => unknown;

export type CandidateSelection = boolean | "unknown";

const buildCandidateSet = <Candidate>({
  candidates,
  complete,
  candidateKey,
}: {
  readonly candidates: readonly Candidate[];
  readonly complete: boolean;
  readonly candidateKey: CandidateKey<Candidate>;
}): CandidateSet<Candidate> => ({
  candidates: uniqBy(candidates, candidateKey),
  complete,
});

export const closedCandidateSet = <Candidate>(
  candidates: readonly Candidate[],
  candidateKey: CandidateKey<Candidate>,
): CandidateSet<Candidate> => buildCandidateSet({ candidates, complete: true, candidateKey });

export const openCandidateSet = <Candidate>(
  candidates: readonly Candidate[],
  candidateKey: CandidateKey<Candidate>,
): CandidateSet<Candidate> => buildCandidateSet({ candidates, complete: false, candidateKey });

export const absentCandidateSet = <Candidate>(): CandidateSet<Candidate> => ({
  candidates: [],
  complete: true,
});

export const unknownCandidateSet = <Candidate>(): CandidateSet<Candidate> => ({
  candidates: [],
  complete: false,
});

export const candidateSetIsAbsent = <Candidate>(candidateSet: CandidateSet<Candidate>): boolean =>
  candidateSet.complete && candidateSet.candidates.length === 0;

export const candidateSetIsUnknown = <Candidate>(candidateSet: CandidateSet<Candidate>): boolean =>
  !candidateSet.complete && candidateSet.candidates.length === 0;

export const joinCandidateSets = <Candidate>(
  candidateSets: readonly CandidateSet<Candidate>[],
  candidateKey: CandidateKey<Candidate>,
): CandidateSet<Candidate> =>
  buildCandidateSet({
    candidates: flatMap(candidateSets, (candidateSet) => candidateSet.candidates),
    complete: candidateSets.every((candidateSet) => candidateSet.complete),
    candidateKey,
  });

export const appendCandidateSets = <Candidate>({
  accumulated,
  next,
  append,
  candidateKey,
}: {
  readonly accumulated: CandidateSet<Candidate>;
  readonly append: (left: Candidate, right: Candidate) => Candidate;
  readonly candidateKey: CandidateKey<Candidate>;
  readonly next: CandidateSet<Candidate>;
}): CandidateSet<Candidate> => {
  if (candidateSetIsAbsent(accumulated) || candidateSetIsAbsent(next)) {
    return absentCandidateSet();
  }
  const candidates =
    accumulated.candidates.length === 0
      ? next.candidates
      : next.candidates.length === 0
        ? accumulated.candidates
        : flatMap(accumulated.candidates, (left) =>
            next.candidates.map((right) => append(left, right)),
          );
  return accumulated.complete && next.complete
    ? closedCandidateSet(candidates, candidateKey)
    : openCandidateSet(candidates, candidateKey);
};

export const mapCandidateSet = <Candidate, MappedCandidate>(
  candidateSet: CandidateSet<Candidate>,
  options: {
    readonly candidateKey: CandidateKey<MappedCandidate>;
    readonly mapCandidate: (candidate: Candidate) => MappedCandidate;
  },
): CandidateSet<MappedCandidate> =>
  buildCandidateSet({
    candidates: candidateSet.candidates.map(options.mapCandidate),
    complete: candidateSet.complete,
    candidateKey: options.candidateKey,
  });

export const filterCandidateSet = <Candidate>(
  candidateSet: CandidateSet<Candidate>,
  predicate: (candidate: Candidate) => boolean,
): CandidateSet<Candidate> => ({
  candidates: candidateSet.candidates.filter(predicate),
  complete: candidateSet.complete,
});

export const flatMapCandidateSet = <Candidate, MappedCandidate>(
  candidateSet: CandidateSet<Candidate>,
  options: {
    readonly candidateKey: CandidateKey<MappedCandidate>;
    readonly mapCandidate: (candidate: Candidate) => CandidateSet<MappedCandidate>;
  },
): CandidateSet<MappedCandidate> => {
  const mappedSets = candidateSet.candidates.map(options.mapCandidate);
  const joined = joinCandidateSets(mappedSets, options.candidateKey);
  return !candidateSet.complete && joined.complete
    ? openCandidateSet(joined.candidates, options.candidateKey)
    : joined;
};

export const selectCandidateSet = <Candidate>(
  selection: CandidateSelection,
  options: {
    readonly candidateKey: CandidateKey<Candidate>;
    readonly whenFalse: CandidateSet<Candidate>;
    readonly whenTrue: CandidateSet<Candidate>;
  },
): CandidateSet<Candidate> => {
  if (selection === "unknown") {
    return joinCandidateSets([options.whenTrue, options.whenFalse], options.candidateKey);
  }
  const selected = selection ? options.whenTrue : options.whenFalse;
  return buildCandidateSet({
    candidates: selected.candidates,
    complete: selected.complete,
    candidateKey: options.candidateKey,
  });
};
