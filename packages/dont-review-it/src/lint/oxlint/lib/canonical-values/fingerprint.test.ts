import { describe, expect, test } from "vite-plus/test";

import { canonicalValueKey, fingerprintValues, isCanonicalValue } from "./fingerprint.ts";

describe("fingerprintValues", () => {
  const testAgainstTheWrittenOrder = test.extend("fingerprintOfWrittenOrder", () =>
    fingerprintValues(["draft", "published"]));

  describe("the same values written in the reverse order", () => {
    const it = testAgainstTheWrittenOrder.extend("fingerprintOfReversedOrder", () =>
      fingerprintValues(["published", "draft"]),
    );

    it("gets the fingerprint of the written order, because order does not count", ({
      fingerprintOfWrittenOrder,
      fingerprintOfReversedOrder,
    }) => {
      expect(fingerprintOfWrittenOrder).toBe(fingerprintOfReversedOrder);
    });
  });

  describe("a list writing one of the values twice", () => {
    const it = testAgainstTheWrittenOrder.extend("fingerprintOfRepeatedValue", () =>
      fingerprintValues(["draft", "draft", "published"]),
    );

    it("gets the fingerprint of the list writing it once", ({
      fingerprintOfRepeatedValue,
      fingerprintOfWrittenOrder,
    }) => {
      expect(fingerprintOfRepeatedValue).toBe(fingerprintOfWrittenOrder);
    });
  });

  describe("a number beside the text that looks the same", () => {
    const it = test
      .extend("fingerprintOfNumberOne", () => fingerprintValues([1]))
      .extend("fingerprintOfTextOne", () => fingerprintValues(["1"]));

    it("gets a different fingerprint", ({ fingerprintOfNumberOne, fingerprintOfTextOne }) => {
      expect(fingerprintOfNumberOne).not.toBe(fingerprintOfTextOne);
    });
  });

  describe("a boolean beside the text that looks the same", () => {
    const it = test
      .extend("fingerprintOfBooleanTrue", () => fingerprintValues([true]))
      .extend("fingerprintOfTextTrue", () => fingerprintValues(["true"]));

    it("gets a different fingerprint", ({ fingerprintOfBooleanTrue, fingerprintOfTextTrue }) => {
      expect(fingerprintOfBooleanTrue).not.toBe(fingerprintOfTextTrue);
    });
  });

  describe("null beside the text that looks the same", () => {
    const it = test
      .extend("fingerprintOfNull", () => fingerprintValues([null]))
      .extend("fingerprintOfTextNull", () => fingerprintValues(["null"]));

    it("gets a different fingerprint", ({ fingerprintOfNull, fingerprintOfTextNull }) => {
      expect(fingerprintOfNull).not.toBe(fingerprintOfTextNull);
    });
  });

  describe("a list holding only one of the values", () => {
    const it = testAgainstTheWrittenOrder.extend("fingerprintOfLoneValue", () =>
      fingerprintValues(["draft"]),
    );

    it("gets a different fingerprint, because the value set differs", ({
      fingerprintOfLoneValue,
      fingerprintOfWrittenOrder,
    }) => {
      expect(fingerprintOfLoneValue).not.toBe(fingerprintOfWrittenOrder);
    });
  });

  describe("a lone value spelling the separator that joins two keys", () => {
    const it = test
      .extend("fingerprintOfTwoSeparateValues", () => fingerprintValues(["a", "b"]))
      .extend("fingerprintOfTheSpelledSeparator", () => fingerprintValues(["a\0string:b"]));

    it("gets a different fingerprint, because the separator cannot be forged", ({
      fingerprintOfTwoSeparateValues,
      fingerprintOfTheSpelledSeparator,
    }) => {
      expect(fingerprintOfTwoSeparateValues).not.toBe(fingerprintOfTheSpelledSeparator);
    });
  });
});

describe("canonicalValueKey", () => {
  describe("a text", () => {
    const it = test.extend("keyOfText", () => canonicalValueKey("draft"));

    it("is keyed by its runtime type as well as its spelling", ({ keyOfText }) => {
      expect(keyOfText).toBe("string:draft");
    });
  });

  describe("a number", () => {
    const it = test.extend("keyOfNumber", () => canonicalValueKey(1));

    it("is keyed by its runtime type as well as its spelling", ({ keyOfNumber }) => {
      expect(keyOfNumber).toBe("number:1");
    });
  });

  describe("a boolean", () => {
    const it = test.extend("keyOfBoolean", () => canonicalValueKey(true));

    it("is keyed by its runtime type as well as its spelling", ({ keyOfBoolean }) => {
      expect(keyOfBoolean).toBe("boolean:true");
    });
  });

  describe("null", () => {
    const it = test.extend("keyOfNull", () => canonicalValueKey(null));

    it("is keyed by its runtime type as well as its spelling", ({ keyOfNull }) => {
      expect(keyOfNull).toBe("null:null");
    });
  });
});

describe("isCanonicalValue", () => {
  describe("the scalars the canonical vocabulary is made of", () => {
    const it = test.extend("canonicalityOfVocabularyScalars", () =>
      [null, "draft", 1, true].map(isCanonicalValue));

    it("recognizes every one of them", ({ canonicalityOfVocabularyScalars }) => {
      expect(canonicalityOfVocabularyScalars).toStrictEqual([true, true, true, true]);
    });
  });

  describe("the runtime values outside the canonical vocabulary", () => {
    const it = test.extend("canonicalityOfForeignValues", () =>
      [undefined, 1n, Symbol("draft"), {}, []].map(isCanonicalValue));

    it("rejects every one of them", ({ canonicalityOfForeignValues }) => {
      expect(canonicalityOfForeignValues).toStrictEqual([false, false, false, false, false]);
    });
  });
});
