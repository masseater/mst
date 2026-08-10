import { expect, test } from "vite-plus/test";

import { fingerprintValues, normalizeValues } from "./fingerprint.ts";

test("the fingerprint does not depend on the order the values were written in", () => {
  expect(fingerprintValues(["draft", "published"])).toBe(fingerprintValues(["published", "draft"]));
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

test("normalization tags each value with its runtime type", () => {
  expect(normalizeValues(["draft", 1, true])).toStrictEqual([
    "boolean:true",
    "number:1",
    "string:draft",
  ]);
});
