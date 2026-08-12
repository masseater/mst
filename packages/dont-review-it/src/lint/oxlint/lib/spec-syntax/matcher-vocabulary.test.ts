import { describe, expect, test } from "vite-plus/test";

import {
  ASSERTION_CHAIN_MODIFIERS,
  CALL_CONTRACT_MATCHERS,
  CANONICAL_SPELLING_BY_REDUNDANT_MATCHER,
  DERIVED_ASSERTION_RECEIVERS,
  EXACT_MATCHERS,
  SNAPSHOT_MATCHERS,
  STRUCTURAL_MATCHERS,
  THROW_EXPECTING_MATCHERS,
  THROW_EXPECTING_MODIFIERS,
  UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER,
  UNVERIFIED_REGION_BY_WEAK_MATCHER,
} from "./matcher-vocabulary.ts";

describe("matcher-vocabulary", () => {
  test("only the two matchers that pin the whole subject count as exact", () => {
    expect([...EXACT_MATCHERS].toSorted()).toStrictEqual(["toBe", "toStrictEqual"]);
  });

  test("structural comparison covers the strict and the loose spelling of equality", () => {
    expect([...STRUCTURAL_MATCHERS].toSorted()).toStrictEqual(["toEqual", "toStrictEqual"]);
  });

  test("loose equality is exact enough to compare structures but too loose to assert with", () => {
    expect(STRUCTURAL_MATCHERS.has("toEqual")).toBe(true);
    expect(EXACT_MATCHERS.has("toEqual")).toBe(false);
    expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.has("toEqual")).toBe(true);
  });

  test("every weak matcher says which part of the subject a pass leaves unverified", () => {
    const silent = [
      ...UNVERIFIED_REGION_BY_WEAK_MATCHER.values(),
      ...UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.values(),
    ].filter((unverified) => unverified.trim() === "");

    expect(silent).toStrictEqual([]);
  });

  test("no matcher is both exact and weak", () => {
    const contested = [...UNVERIFIED_REGION_BY_WEAK_MATCHER.keys()].filter((name) =>
      EXACT_MATCHERS.has(name),
    );

    expect(contested).toStrictEqual([]);
  });

  test("a matcher that pins how a mock was called is not weak", () => {
    const contested = [...UNVERIFIED_REGION_BY_WEAK_MATCHER.keys()].filter((name) =>
      CALL_CONTRACT_MATCHERS.has(name),
    );

    expect(contested).toStrictEqual([]);
    expect(CALL_CONTRACT_MATCHERS.has("toHaveBeenCalledWith")).toBe(true);
  });

  test("every matcher that records a snapshot advances the same recorded numbering", () => {
    expect([...SNAPSHOT_MATCHERS].toSorted()).toStrictEqual([
      "matchSnapshot",
      "toMatchFileSnapshot",
      "toMatchInlineSnapshot",
      "toMatchSnapshot",
      "toThrowErrorMatchingInlineSnapshot",
      "toThrowErrorMatchingSnapshot",
    ]);
  });

  test("a weak matcher names the region a pass left alone", () => {
    expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toMatchObject")).toBe(
      "every property the subject carries that the expected object does not name",
    );
    expect(UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.get("stringContaining")).toBe(
      "every character of the subject outside the expected substring",
    );
  });

  test("a matcher outside the weak vocabulary names no unverified region", () => {
    expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toStrictEqual")).toBe(undefined);
    expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toHaveBeenCalledWith")).toBe(undefined);
  });

  test("an asymmetric matcher is named apart from the matchers a chain ends with", () => {
    expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.has("stringContaining")).toBe(false);
    expect(UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.has("toMatchObject")).toBe(false);
  });

  test("a second spelling of an exact comparison names the one spelling to write", () => {
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeNull")).toBe("toBe(null)");
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeUndefined")).toBe("toBe(undefined)");
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeNaN")).toBe("toBe(Number.NaN)");
  });

  test("a second spelling of a call-contract matcher names the one spelling to write", () => {
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeCalledWith")).toBe(
      "toHaveBeenCalledWith()",
    );
  });

  test("the one spelling a redundant matcher points at is itself not redundant", () => {
    const circular = [...CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.values()].filter((writeInstead) =>
      [...CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.keys()].some((name) =>
        writeInstead.startsWith(`${name}(`),
      ),
    );

    expect(circular).toStrictEqual([]);
  });

  test("a matcher spelled the one way names nothing to write instead", () => {
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBe")).toBe(undefined);
    expect(CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toHaveBeenCalledWith")).toBe(undefined);
  });

  test("the members that only turn an assertion around are not matchers themselves", () => {
    expect([...ASSERTION_CHAIN_MODIFIERS].toSorted()).toStrictEqual(["not", "rejects", "resolves"]);

    const misfiled = [...ASSERTION_CHAIN_MODIFIERS].filter(
      (member) => EXACT_MATCHERS.has(member) || UNVERIFIED_REGION_BY_WEAK_MATCHER.has(member),
    );
    expect(misfiled).toStrictEqual([]);
  });

  test("every matcher that demands the subject fail is named", () => {
    expect([...THROW_EXPECTING_MATCHERS].toSorted()).toStrictEqual([
      "toThrow",
      "toThrowError",
      "toThrowErrorMatchingInlineSnapshot",
      "toThrowErrorMatchingSnapshot",
    ]);
  });

  test("a rejection is demanded by a chain modifier rather than by a matcher of its own", () => {
    expect([...THROW_EXPECTING_MODIFIERS]).toStrictEqual(["rejects"]);

    const stray = [...THROW_EXPECTING_MODIFIERS].filter(
      (modifier) => !ASSERTION_CHAIN_MODIFIERS.has(modifier),
    );
    expect(stray).toStrictEqual([]);
  });

  test("turning an assertion around leaves the matcher that demands the failure spelled the same", () => {
    const misfiled = [...THROW_EXPECTING_MATCHERS].filter((name) =>
      ASSERTION_CHAIN_MODIFIERS.has(name),
    );

    expect(misfiled).toStrictEqual([]);
    expect(THROW_EXPECTING_MATCHERS.has("not")).toBe(false);
  });

  test("the receivers that only change when an assertion runs are named apart", () => {
    expect([...DERIVED_ASSERTION_RECEIVERS].toSorted()).toStrictEqual(["poll", "soft"]);
  });

  test("no name is filed both as a matcher and as something that is not one", () => {
    const asserting = new Set([
      ...EXACT_MATCHERS,
      ...STRUCTURAL_MATCHERS,
      ...CALL_CONTRACT_MATCHERS,
      ...SNAPSHOT_MATCHERS,
      ...UNVERIFIED_REGION_BY_WEAK_MATCHER.keys(),
    ]);
    const misfiled = [...ASSERTION_CHAIN_MODIFIERS, ...DERIVED_ASSERTION_RECEIVERS].filter(
      (member) => asserting.has(member),
    );

    expect(misfiled).toStrictEqual([]);
  });
});
