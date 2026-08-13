import { describe, expect, test } from "vite-plus/test";

import { matchesGlobSegment } from "./glob-segment.ts";

describe("matchesGlobSegment", () => {
  describe("a pattern without a star", () => {
    describe("a segment spelled the same way as the pattern", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "packages", pattern: "packages" }));

      it("compares the two for equality and accepts them", ({ match }) => {
        expect(match).toBe(true);
      });
    });

    describe("a segment that only shares a prefix with the pattern", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "package", pattern: "packages" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });
  });

  describe("a pattern carrying one star between a head and a tail", () => {
    describe("a segment wrapped in the head and the tail", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "__fixtures__", pattern: "__*__" }));

      it("accepts anything between the two", ({ match }) => {
        expect(match).toBe(true);
      });
    });

    describe("a segment that does not start with the head", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "fixtures__", pattern: "__*__" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });

    describe("a segment that does not end with the tail", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "__fixtures", pattern: "__*__" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });

    describe("a segment shorter than the head and the tail together", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "__", pattern: "__*__" }));

      it("refuses it instead of letting the two ends overlap", ({ match }) => {
        expect(match).toBe(false);
      });
    });

    describe("a segment that is exactly the head and the tail", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "____", pattern: "__*__" }));

      it("accepts it with nothing between the two", ({ match }) => {
        expect(match).toBe(true);
      });
    });
  });

  describe("a pattern carrying literals between its stars", () => {
    describe("a segment holding the inner literals in the order the pattern gives", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "a-one-two-z", pattern: "a*one*two*z" }));

      it("accepts it", ({ match }) => {
        expect(match).toBe(true);
      });
    });

    describe("a segment holding the inner literals in the reverse of that order", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "a-two-one-z", pattern: "a*one*two*z" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });

    describe("a segment missing one of the inner literals", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "a-two-three-z", pattern: "a*one*two*three*z" }));

      it("stops looking there rather than resuming at a later literal", ({ match }) => {
        expect(match).toBe(false);
      });
    });

    describe("a segment whose only copy of an inner literal sits inside the tail", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "a-z-one", pattern: "a*one*z-one" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });
  });

  describe("a pattern that is a lone star", () => {
    const it = test.extend("match", () =>
      matchesGlobSegment({ segment: "anything", pattern: "*" }));

    it("accepts every segment", ({ match }) => {
      expect(match).toBe(true);
    });
  });

  describe("a pattern ending in a star", () => {
    describe("a segment carrying the prefix that precedes the star", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "index.test.ts", pattern: "index*" }));

      it("accepts it as a prefix match", ({ match }) => {
        expect(match).toBe(true);
      });
    });

    describe("a segment that does not carry that prefix", () => {
      const it = test.extend("match", () =>
        matchesGlobSegment({ segment: "other.test.ts", pattern: "index*" }));

      it("refuses it", ({ match }) => {
        expect(match).toBe(false);
      });
    });
  });
});
