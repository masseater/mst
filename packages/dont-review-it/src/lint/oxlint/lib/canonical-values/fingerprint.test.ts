import { describe, expect, test } from "vite-plus/test";

import { canonicalValueKey, fingerprintValues } from "./fingerprint.ts";

describe("fingerprint", () => {
  test("the fingerprint does not depend on the order the values were written in", () => {
    expect(fingerprintValues(["draft", "published"])).toBe(
      fingerprintValues(["published", "draft"]),
    );
  });

  test("the fingerprint does not depend on a value appearing twice", () => {
    expect(fingerprintValues(["draft", "draft", "published"])).toBe(
      fingerprintValues(["draft", "published"]),
    );
  });

  test("values that differ only by type get different fingerprints", () => {
    expect(fingerprintValues([1])).not.toBe(fingerprintValues(["1"]));
    expect(fingerprintValues([true])).not.toBe(fingerprintValues(["true"]));
  });

  test("different value sets get different fingerprints", () => {
    expect(fingerprintValues(["draft"])).not.toBe(fingerprintValues(["draft", "published"]));
  });

  test("a value is keyed by its runtime type as well as its spelling", () => {
    expect(canonicalValueKey("draft")).toBe("string:draft");
    expect(canonicalValueKey(1)).toBe("number:1");
    expect(canonicalValueKey(true)).toBe("boolean:true");
  });
});
