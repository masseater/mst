import { describe, expect, test } from "vite-plus/test";

import {
  ASSERTION_CHAIN_MODIFIERS,
  CALL_CONTRACT_MATCHERS,
  DERIVED_ASSERTION_RECEIVERS,
  EXACT_MATCHERS,
  EXPECT_UTILITY_MEMBERS,
  MATCHER_FAMILIES,
  REDUNDANT_MATCHERS,
  RETURN_RECORD_MATCHERS,
  SNAPSHOT_MATCHERS,
  STRUCTURAL_MATCHERS,
  THROW_EXPECTING_MATCHERS,
  THROW_EXPECTING_MODIFIERS,
  unverifiedRegionOf,
  WEAK_ASYMMETRIC_MATCHERS,
  WEAK_MATCHERS,
  writeInsteadOf,
} from "./matcher-vocabulary.ts";

const spelledNames = (matchers: readonly { readonly name: string }[]): readonly string[] =>
  matchers.map((matcher) => matcher.name);

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
    expect(spelledNames(WEAK_MATCHERS)).toContain("toEqual");
  });

  test("every weak matcher says which part of the subject a pass leaves unverified", () => {
    const silent = [...WEAK_MATCHERS, ...WEAK_ASYMMETRIC_MATCHERS].filter(
      (matcher) => matcher.unverified.trim() === "",
    );

    expect(silent).toStrictEqual([]);
  });

  test("every weak matcher is filed under one of the named families", () => {
    const stray = [...WEAK_MATCHERS, ...WEAK_ASYMMETRIC_MATCHERS].filter(
      (matcher) => !MATCHER_FAMILIES.includes(matcher.family),
    );

    expect(stray).toStrictEqual([]);
  });

  test("no matcher is both exact and weak", () => {
    const contested = spelledNames(WEAK_MATCHERS).filter((name) => EXACT_MATCHERS.has(name));

    expect(contested).toStrictEqual([]);
  });

  test("a matcher that pins how a mock was called is not weak", () => {
    const contested = spelledNames(WEAK_MATCHERS).filter((name) =>
      CALL_CONTRACT_MATCHERS.has(name),
    );

    expect(contested).toStrictEqual([]);
    expect(CALL_CONTRACT_MATCHERS.has("toHaveBeenCalledWith")).toBe(true);
  });

  test("a matcher that reads what a mock returned is left out of both sets", () => {
    const contested = spelledNames(WEAK_MATCHERS).filter((name) =>
      RETURN_RECORD_MATCHERS.has(name),
    );

    expect(contested).toStrictEqual([]);
    expect(EXACT_MATCHERS.has("toHaveReturnedWith")).toBe(false);
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
    expect(unverifiedRegionOf("toMatchObject")).toBe(
      "every property the subject carries that the expected object does not name",
    );
    expect(unverifiedRegionOf("stringContaining")).toBe(
      "every character of the subject outside the expected substring",
    );
  });

  test("a matcher outside the weak vocabulary names no unverified region", () => {
    expect(unverifiedRegionOf("toStrictEqual")).toBe(null);
    expect(unverifiedRegionOf("toHaveBeenCalledWith")).toBe(null);
  });

  test("a second spelling of an exact comparison names the one spelling to write", () => {
    expect(writeInsteadOf("toBeNull")).toBe("toBe(null)");
    expect(writeInsteadOf("toBeUndefined")).toBe("toBe(undefined)");
    expect(writeInsteadOf("toBeNaN")).toBe("toBe(Number.NaN)");
  });

  test("a second spelling of a call-contract matcher names the one spelling to write", () => {
    expect(writeInsteadOf("toBeCalledWith")).toBe("toHaveBeenCalledWith()");
  });

  test("the one spelling a redundant matcher points at is itself not redundant", () => {
    const circular = REDUNDANT_MATCHERS.filter((matcher) =>
      REDUNDANT_MATCHERS.some((other) => matcher.writeInstead.startsWith(`${other.name}(`)),
    );

    expect(circular).toStrictEqual([]);
  });

  test("a matcher spelled the one way names nothing to write instead", () => {
    expect(writeInsteadOf("toBe")).toBe(null);
    expect(writeInsteadOf("toHaveBeenCalledWith")).toBe(null);
  });

  test("the members that only turn an assertion around are not matchers themselves", () => {
    expect([...ASSERTION_CHAIN_MODIFIERS].toSorted()).toStrictEqual(["not", "rejects", "resolves"]);

    const misfiled = [...ASSERTION_CHAIN_MODIFIERS].filter(
      (member) => EXACT_MATCHERS.has(member) || unverifiedRegionOf(member) !== null,
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

  test("the members that do work beside asserting are named apart from the matchers", () => {
    expect([...EXPECT_UTILITY_MEMBERS].toSorted()).toStrictEqual([
      "addEqualityTesters",
      "addSnapshotSerializer",
      "assert",
      "assertions",
      "extend",
      "getState",
      "hasAssertions",
      "setState",
      "unreachable",
    ]);
  });

  test("no name is filed both as a matcher and as something that is not one", () => {
    const asserting = new Set([
      ...EXACT_MATCHERS,
      ...STRUCTURAL_MATCHERS,
      ...CALL_CONTRACT_MATCHERS,
      ...RETURN_RECORD_MATCHERS,
      ...SNAPSHOT_MATCHERS,
      ...WEAK_MATCHERS.map((matcher) => matcher.name),
    ]);
    const misfiled = [
      ...ASSERTION_CHAIN_MODIFIERS,
      ...DERIVED_ASSERTION_RECEIVERS,
      ...EXPECT_UTILITY_MEMBERS,
    ].filter((member) => asserting.has(member));

    expect(misfiled).toStrictEqual([]);
  });
});
