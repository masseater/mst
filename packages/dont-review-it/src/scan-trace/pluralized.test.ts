import { describe, expect, test } from "vite-plus/test";

import { counted, pluralized } from "./pluralized.ts";

describe("pluralized", () => {
  describe("a single subject", () => {
    const it = test.extend("word", () => pluralized({ count: 1, noun: "definition" }));

    it("keeps the noun as it was written", ({ word }) => {
      expect(word).toBe("definition");
    });
  });

  describe("an absent subject", () => {
    const it = test.extend("word", () => pluralized({ count: 0, noun: "definition" }));

    it("reads as a plural", ({ word }) => {
      expect(word).toBe("definitions");
    });
  });

  describe("several subjects", () => {
    const it = test.extend("word", () => pluralized({ count: 7, noun: "manifest" }));

    it("read as a plural", ({ word }) => {
      expect(word).toBe("manifests");
    });
  });
});

describe("counted", () => {
  describe("a single subject", () => {
    const it = test.extend("phrase", () => counted({ count: 1, noun: "problem" }));

    it("is spelled with its number in front", ({ phrase }) => {
      expect(phrase).toBe("1 problem");
    });
  });

  describe("several subjects", () => {
    const it = test.extend("phrase", () => counted({ count: 4, noun: "problem" }));

    it("carry the plural noun behind the number", ({ phrase }) => {
      expect(phrase).toBe("4 problems");
    });
  });
});
