import { describe, expect, test } from "vite-plus/test";

import { formatElapsed } from "./format-elapsed.ts";

describe("formatElapsed", () => {
  describe("a span measured at twelve and a bit seconds", () => {
    const it = test.extend("theSpelling", () => formatElapsed(12_399));

    it("cuts the span down to a tenth of a second", ({ theSpelling }) => {
      expect(theSpelling).toBe("12.3s");
    });
  });

  describe("a span measured just under a minute", () => {
    const it = test.extend("theSpelling", () => formatElapsed(59_999));

    it("keeps the span in seconds", ({ theSpelling }) => {
      expect(theSpelling).toBe("59.9s");
    });
  });

  describe("a span measured at exactly a minute", () => {
    const it = test.extend("theSpelling", () => formatElapsed(60_000));

    it("turns the span into minutes and seconds", ({ theSpelling }) => {
      expect(theSpelling).toBe("1m00s");
    });
  });

  describe("a span measured at four minutes and a bit", () => {
    const it = test.extend("theSpelling", () => formatElapsed(245_000));

    it("cuts the seconds down to whole seconds", ({ theSpelling }) => {
      expect(theSpelling).toBe("4m05s");
    });
  });

  describe("a span measured at no time at all", () => {
    const it = test.extend("theSpelling", () => formatElapsed(0));

    it("still spells a tenth of a second", ({ theSpelling }) => {
      expect(theSpelling).toBe("0.0s");
    });
  });
});
