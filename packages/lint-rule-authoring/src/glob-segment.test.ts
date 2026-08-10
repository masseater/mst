import { describe, expect, test } from "vite-plus/test";

import { matchesGlobSegment } from "./glob-segment.ts";

const matches = (segment: string, pattern: string): boolean =>
  matchesGlobSegment({ segment, pattern });

describe("matchesGlobSegment", () => {
  test("compares a pattern without a star for equality", () => {
    expect(matches("packages", "packages")).toBe(true);
    expect(matches("package", "packages")).toBe(false);
  });

  test("accepts anything between a head and a tail", () => {
    expect(matches("__fixtures__", "__*__")).toBe(true);
  });

  test("refuses a segment that does not start with the head", () => {
    expect(matches("fixtures__", "__*__")).toBe(false);
  });

  test("refuses a segment that does not end with the tail", () => {
    expect(matches("__fixtures", "__*__")).toBe(false);
  });

  test("refuses a segment shorter than the head and tail together", () => {
    expect(matches("__", "__*__")).toBe(false);
  });

  test("accepts a segment that is exactly the head and tail with nothing between", () => {
    expect(matches("____", "__*__")).toBe(true);
  });

  test("requires the inner literals to appear in the order the pattern gives", () => {
    expect(matches("a-one-two-z", "a*one*two*z")).toBe(true);
    expect(matches("a-two-one-z", "a*one*two*z")).toBe(false);
  });

  test("refuses an inner literal that only appears inside the tail", () => {
    expect(matches("a-z-one", "a*one*z-one")).toBe(false);
  });

  test("accepts a lone star", () => {
    expect(matches("anything", "*")).toBe(true);
  });

  test("accepts a trailing star as a prefix match", () => {
    expect(matches("index.test.ts", "index*")).toBe(true);
    expect(matches("other.test.ts", "index*")).toBe(false);
  });
});
