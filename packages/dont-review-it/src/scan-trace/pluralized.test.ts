import { describe, expect, test } from "vite-plus/test";

import { counted, pluralized } from "./pluralized.ts";

describe("pluralized", () => {
  test("a single subject keeps the noun as it was written", () => {
    expect(pluralized({ count: 1, noun: "definition" })).toBe("definition");
  });

  test("an absent subject reads as a plural", () => {
    expect(pluralized({ count: 0, noun: "definition" })).toBe("definitions");
  });

  test("several subjects read as a plural", () => {
    expect(pluralized({ count: 7, noun: "manifest" })).toBe("manifests");
  });
});

describe("counted", () => {
  test("a single subject is spelled with its number in front", () => {
    expect(counted({ count: 1, noun: "problem" })).toBe("1 problem");
  });

  test("several subjects carry the plural noun behind the number", () => {
    expect(counted({ count: 4, noun: "problem" })).toBe("4 problems");
  });
});
