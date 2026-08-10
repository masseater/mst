import { describe, expect, test } from "vite-plus/test";

import { isFiniteVocabulary } from "./finite-value-syntax.ts";

describe("finite-value-syntax", () => {
  test("two distinct spellings are a vocabulary", () => {
    expect(isFiniteVocabulary(["draft", "published"])).toBe(true);
  });

  test("one spelling names a single value rather than a vocabulary", () => {
    expect(isFiniteVocabulary(["draft"])).toBe(false);
  });

  test("the same spelling repeated is still one value", () => {
    expect(isFiniteVocabulary(["draft", "draft"])).toBe(false);
  });

  test("both booleans spelled out are the two sides of a flag, not a vocabulary", () => {
    expect(isFiniteVocabulary([true, false])).toBe(false);
  });

  test("a boolean beside a spelling is a vocabulary because the flag is not the whole set", () => {
    expect(isFiniteVocabulary([true, "draft"])).toBe(true);
  });

  test("a number and the same digits written as text are two values", () => {
    expect(isFiniteVocabulary([1, "1"])).toBe(true);
  });
});
