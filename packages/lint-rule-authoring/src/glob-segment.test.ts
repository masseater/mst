import { describe, expect, test } from "vite-plus/test";

import { matchesGlobSegment } from "./glob-segment.ts";

const it = test
  .extend("starlessEqualMatch", () =>
    matchesGlobSegment({ segment: "packages", pattern: "packages" }))
  .extend("starlessUnequalMatch", () =>
    matchesGlobSegment({ segment: "package", pattern: "packages" }),
  )
  .extend("wrappedSegmentMatch", () =>
    matchesGlobSegment({ segment: "__fixtures__", pattern: "__*__" }),
  )
  .extend("missingHeadMatch", () => matchesGlobSegment({ segment: "fixtures__", pattern: "__*__" }))
  .extend("missingTailMatch", () => matchesGlobSegment({ segment: "__fixtures", pattern: "__*__" }))
  .extend("tooShortForBothEndsMatch", () => matchesGlobSegment({ segment: "__", pattern: "__*__" }))
  .extend("bothEndsAndNothingBetweenMatch", () =>
    matchesGlobSegment({ segment: "____", pattern: "__*__" }),
  )
  .extend("orderedInnerLiteralsMatch", () =>
    matchesGlobSegment({ segment: "a-one-two-z", pattern: "a*one*two*z" }),
  )
  .extend("swappedInnerLiteralsMatch", () =>
    matchesGlobSegment({ segment: "a-two-one-z", pattern: "a*one*two*z" }),
  )
  .extend("skippedInnerLiteralMatch", () =>
    matchesGlobSegment({ segment: "a-two-three-z", pattern: "a*one*two*three*z" }),
  )
  .extend("innerLiteralInsideTailMatch", () =>
    matchesGlobSegment({ segment: "a-z-one", pattern: "a*one*z-one" }),
  )
  .extend("loneStarMatch", () => matchesGlobSegment({ segment: "anything", pattern: "*" }))
  .extend("trailingStarPrefixMatch", () =>
    matchesGlobSegment({ segment: "index.test.ts", pattern: "index*" }),
  )
  .extend("trailingStarOtherPrefixMatch", () =>
    matchesGlobSegment({ segment: "other.test.ts", pattern: "index*" }),
  );

describe("matchesGlobSegment", () => {
  it("compares a pattern without a star for equality", ({ starlessEqualMatch }) => {
    expect(starlessEqualMatch).toBe(true);
  });

  it("refuses a segment that only shares a prefix with a pattern without a star", ({
    starlessUnequalMatch,
  }) => {
    expect(starlessUnequalMatch).toBe(false);
  });

  it("accepts anything between a head and a tail", ({ wrappedSegmentMatch }) => {
    expect(wrappedSegmentMatch).toBe(true);
  });

  it("refuses a segment that does not start with the head", ({ missingHeadMatch }) => {
    expect(missingHeadMatch).toBe(false);
  });

  it("refuses a segment that does not end with the tail", ({ missingTailMatch }) => {
    expect(missingTailMatch).toBe(false);
  });

  it("refuses a segment shorter than the head and tail together", ({
    tooShortForBothEndsMatch,
  }) => {
    expect(tooShortForBothEndsMatch).toBe(false);
  });

  it("accepts a segment that is exactly the head and tail with nothing between", ({
    bothEndsAndNothingBetweenMatch,
  }) => {
    expect(bothEndsAndNothingBetweenMatch).toBe(true);
  });

  it("requires the inner literals to appear in the order the pattern gives", ({
    orderedInnerLiteralsMatch,
  }) => {
    expect(orderedInnerLiteralsMatch).toBe(true);
  });

  it("refuses inner literals that appear in the reverse of the pattern order", ({
    swappedInnerLiteralsMatch,
  }) => {
    expect(swappedInnerLiteralsMatch).toBe(false);
  });

  it("stops looking once an inner literal is missing rather than resuming at a later one", ({
    skippedInnerLiteralMatch,
  }) => {
    expect(skippedInnerLiteralMatch).toBe(false);
  });

  it("refuses an inner literal that only appears inside the tail", ({
    innerLiteralInsideTailMatch,
  }) => {
    expect(innerLiteralInsideTailMatch).toBe(false);
  });

  it("accepts a lone star", ({ loneStarMatch }) => {
    expect(loneStarMatch).toBe(true);
  });

  it("accepts a trailing star as a prefix match", ({ trailingStarPrefixMatch }) => {
    expect(trailingStarPrefixMatch).toBe(true);
  });

  it("refuses a segment that does not carry the prefix before a trailing star", ({
    trailingStarOtherPrefixMatch,
  }) => {
    expect(trailingStarOtherPrefixMatch).toBe(false);
  });
});
