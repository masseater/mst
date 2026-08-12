import { describe, expect, test } from "vite-plus/test";

import { canonicalValueKey, fingerprintValues } from "./fingerprint.ts";

const it = test
  .extend("fingerprintOfWrittenOrder", () => fingerprintValues(["draft", "published"]))
  .extend("fingerprintOfReversedOrder", () => fingerprintValues(["published", "draft"]))
  .extend("fingerprintOfRepeatedValue", () => fingerprintValues(["draft", "draft", "published"]))
  .extend("fingerprintOfNumberOne", () => fingerprintValues([1]))
  .extend("fingerprintOfTextOne", () => fingerprintValues(["1"]))
  .extend("fingerprintOfBooleanTrue", () => fingerprintValues([true]))
  .extend("fingerprintOfTextTrue", () => fingerprintValues(["true"]))
  .extend("fingerprintOfLoneValue", () => fingerprintValues(["draft"]))
  .extend("keyOfText", () => canonicalValueKey("draft"))
  .extend("keyOfNumber", () => canonicalValueKey(1))
  .extend("keyOfBoolean", () => canonicalValueKey(true));

describe("fingerprint", () => {
  it("the fingerprint does not depend on the order the values were written in", ({
    fingerprintOfWrittenOrder,
    fingerprintOfReversedOrder,
  }) => {
    expect(fingerprintOfWrittenOrder).toBe(fingerprintOfReversedOrder);
  });

  it("the fingerprint does not depend on a value appearing twice", ({
    fingerprintOfRepeatedValue,
    fingerprintOfWrittenOrder,
  }) => {
    expect(fingerprintOfRepeatedValue).toBe(fingerprintOfWrittenOrder);
  });

  it("a number and the text that looks the same get different fingerprints", ({
    fingerprintOfNumberOne,
    fingerprintOfTextOne,
  }) => {
    expect(fingerprintOfNumberOne).not.toBe(fingerprintOfTextOne);
  });

  it("a boolean and the text that looks the same get different fingerprints", ({
    fingerprintOfBooleanTrue,
    fingerprintOfTextTrue,
  }) => {
    expect(fingerprintOfBooleanTrue).not.toBe(fingerprintOfTextTrue);
  });

  it("different value sets get different fingerprints", ({
    fingerprintOfLoneValue,
    fingerprintOfWrittenOrder,
  }) => {
    expect(fingerprintOfLoneValue).not.toBe(fingerprintOfWrittenOrder);
  });

  it("a text is keyed by its runtime type as well as its spelling", ({ keyOfText }) => {
    expect(keyOfText).toBe("string:draft");
  });

  it("a number is keyed by its runtime type as well as its spelling", ({ keyOfNumber }) => {
    expect(keyOfNumber).toBe("number:1");
  });

  it("a boolean is keyed by its runtime type as well as its spelling", ({ keyOfBoolean }) => {
    expect(keyOfBoolean).toBe("boolean:true");
  });
});
