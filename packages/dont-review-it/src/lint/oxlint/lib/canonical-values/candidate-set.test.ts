import { describe, expect, test } from "vite-plus/test";

import {
  absentCandidateSet,
  appendCandidateSets,
  candidateSetIsAbsent,
  candidateSetIsUnknown,
  closedCandidateSet,
  filterCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  selectCandidateSet,
  unknownCandidateSet,
} from "./candidate-set.ts";

const byName = (candidate: { readonly name: string }): string => candidate.name;

describe("candidate-set", () => {
  test("an unknown appended fragment keeps a known prefix open", () => {
    expect(
      appendCandidateSets({
        accumulated: closedCandidateSet(["draft"], String),
        append: (left, right) => `${left}:${right}`,
        candidateKey: String,
        next: unknownCandidateSet<string>(),
      }),
    ).toStrictEqual({ candidates: ["draft"], complete: false });
  });

  test("an unknown prefix keeps a known appended fragment open", () => {
    expect(
      appendCandidateSets({
        accumulated: unknownCandidateSet<string>(),
        append: (left, right) => `${left}:${right}`,
        candidateKey: String,
        next: closedCandidateSet(["published"], String),
      }),
    ).toStrictEqual({ candidates: ["published"], complete: false });
  });

  test("a complete empty side leaves no append candidate", () => {
    expect(
      appendCandidateSets({
        accumulated: absentCandidateSet<string>(),
        append: (left, right) => `${left}:${right}`,
        candidateKey: String,
        next: closedCandidateSet(["published"], String),
      }),
    ).toStrictEqual({ candidates: [], complete: true });
  });

  test("a closed empty set represents an absent result", () => {
    const candidates = absentCandidateSet<string>();

    expect(candidateSetIsAbsent(candidates)).toBe(true);
    expect(candidateSetIsUnknown(candidates)).toBe(false);
  });

  test("an open empty set represents an unknown result", () => {
    const candidates = unknownCandidateSet<string>();

    expect(candidateSetIsUnknown(candidates)).toBe(true);
    expect(candidateSetIsAbsent(candidates)).toBe(false);
  });

  test("an open set keeps every known candidate", () => {
    const candidates = openCandidateSet([{ name: "local" }, { name: "route" }], byName);

    expect(candidates).toStrictEqual({
      candidates: [{ name: "local" }, { name: "route" }],
      complete: false,
    });
  });

  test("constructors deduplicate candidates by the supplied key", () => {
    const candidates = closedCandidateSet(
      [
        { name: "owner", source: "first" },
        { name: "owner", source: "second" },
      ],
      byName,
    );

    expect(candidates.candidates).toStrictEqual([{ name: "owner", source: "first" }]);
  });

  test("joining sets keeps candidates and becomes open when one input is open", () => {
    const joined = joinCandidateSets(
      [
        closedCandidateSet([{ name: "local" }], byName),
        openCandidateSet([{ name: "route" }, { name: "local" }], byName),
      ],
      byName,
    );

    expect(joined).toStrictEqual({
      candidates: [{ name: "local" }, { name: "route" }],
      complete: false,
    });
  });

  test("joining no sets produces the closed empty set", () => {
    expect(candidateSetIsAbsent(joinCandidateSets<string>([], (candidate) => candidate))).toBe(
      true,
    );
  });

  test("mapping preserves openness and deduplicates mapped candidates", () => {
    const mapped = mapCandidateSet(
      openCandidateSet([1, 3], (candidate) => candidate),
      {
        mapCandidate: (candidate) => candidate % 2,
        candidateKey: (candidate) => candidate,
      },
    );

    expect(mapped).toStrictEqual({ candidates: [1], complete: false });
  });

  test("filtering removes candidates without changing completeness", () => {
    const filtered = filterCandidateSet(
      openCandidateSet([1, 2, 3], (candidate) => candidate),
      (candidate) => candidate % 2 === 1,
    );

    expect(filtered).toStrictEqual({ candidates: [1, 3], complete: false });
  });

  test("flat mapping joins candidate results and propagates nested openness", () => {
    const mapped = flatMapCandidateSet(
      closedCandidateSet([1, 2], (candidate) => candidate),
      {
        mapCandidate: (candidate) =>
          candidate === 1
            ? closedCandidateSet([{ name: "known" }], byName)
            : openCandidateSet([{ name: "possible" }, { name: "known" }], byName),
        candidateKey: byName,
      },
    );

    expect(mapped).toStrictEqual({
      candidates: [{ name: "known" }, { name: "possible" }],
      complete: false,
    });
  });

  test("flat mapping an open source remains open when all known branches are closed", () => {
    const mapped = flatMapCandidateSet(
      openCandidateSet([1], (candidate) => candidate),
      {
        mapCandidate: (candidate) =>
          closedCandidateSet([candidate], (mappedCandidate) => mappedCandidate),
        candidateKey: (candidate) => candidate,
      },
    );

    expect(mapped).toStrictEqual({ candidates: [1], complete: false });
  });

  test("selection takes only the statically selected branch", () => {
    const whenTrue = closedCandidateSet([{ name: "true" }], byName);
    const whenFalse = openCandidateSet([{ name: "false" }], byName);
    const options = { candidateKey: byName, whenFalse, whenTrue };

    expect(selectCandidateSet(true, options)).toStrictEqual(whenTrue);
    expect(selectCandidateSet(false, options)).toStrictEqual(whenFalse);
  });

  test("unknown selection joins both branches and deduplicates them", () => {
    const selected = selectCandidateSet("unknown", {
      whenTrue: closedCandidateSet([{ name: "shared" }, { name: "true" }], byName),
      whenFalse: closedCandidateSet([{ name: "shared" }, { name: "false" }], byName),
      candidateKey: byName,
    });

    expect(selected).toStrictEqual({
      candidates: [{ name: "shared" }, { name: "true" }, { name: "false" }],
      complete: true,
    });
  });
});
