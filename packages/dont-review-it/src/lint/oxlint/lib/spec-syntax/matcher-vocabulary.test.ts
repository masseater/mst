import { describe, expect, test } from "vite-plus/test";

import {
  ASSERTION_CHAIN_MODIFIERS,
  ASSERTION_COUNT_DECLARATIONS,
  CALL_CONTRACT_MATCHERS,
  DERIVED_ASSERTION_RECEIVERS,
  EXACT_MATCHERS,
  REDUNDANT_MATCHERS,
  SNAPSHOT_MATCHERS,
  STRUCTURAL_MATCHERS,
  THROW_EXPECTING_MATCHERS,
  THROW_EXPECTING_MODIFIERS,
  WEAK_ASYMMETRIC_MATCHERS,
  WEAK_MATCHERS,
} from "./matcher-vocabulary.ts";

const it = test
  .extend("theMatchersThatPinTheWholeSubject", () => EXACT_MATCHERS)
  .extend("theMatchersThatCompareStructures", () => STRUCTURAL_MATCHERS)
  .extend("looseEqualityAmongTheStructuralMatchers", () => STRUCTURAL_MATCHERS.has("toEqual"))
  .extend("looseEqualityAmongTheExactMatchers", () => EXACT_MATCHERS.has("toEqual"))
  .extend("looseEqualityAmongTheWeakMatchers", () =>
    WEAK_MATCHERS.some((matcher) => matcher.name === "toEqual"),
  )
  .extend("weakMatchersNamingNothingAsUnverified", () =>
    [...WEAK_MATCHERS, ...WEAK_ASYMMETRIC_MATCHERS].filter(
      (matcher) => matcher.unverified.trim() === "",
    ),
  )
  .extend("weakMatchersFiledOutsideTheNamedFamilies", () =>
    [...WEAK_MATCHERS, ...WEAK_ASYMMETRIC_MATCHERS].filter(
      (matcher) =>
        ![
          "containment",
          "loose-structure",
          "magnitude",
          "partial-shape",
          "runtime-type",
          "thrown-value",
          "truthiness",
        ].includes(matcher.family),
    ),
  )
  .extend("weakMatchersThatAreAlsoExact", () =>
    WEAK_MATCHERS.filter((matcher) => EXACT_MATCHERS.has(matcher.name)),
  )
  .extend("weakMatchersThatAlsoPinHowAMockWasCalled", () =>
    WEAK_MATCHERS.filter((matcher) => CALL_CONTRACT_MATCHERS.has(matcher.name)),
  )
  .extend("theArgumentPinningMatcherAmongTheCallContractMatchers", () =>
    CALL_CONTRACT_MATCHERS.has("toHaveBeenCalledWith"),
  )
  .extend("theMatchersThatRecordASnapshot", () => SNAPSHOT_MATCHERS)
  .extend("redundantMatchersPointingAtAnotherRedundantSpelling", () =>
    REDUNDANT_MATCHERS.filter((matcher) =>
      REDUNDANT_MATCHERS.some((other) => matcher.writeInstead.startsWith(`${other.name}(`)),
    ),
  )
  .extend("theMembersThatOnlyTurnAnAssertionAround", () => ASSERTION_CHAIN_MODIFIERS)
  .extend("chainModifiersFiledAsMatchersThemselves", () =>
    [...ASSERTION_CHAIN_MODIFIERS].filter(
      (member) =>
        EXACT_MATCHERS.has(member) ||
        [...WEAK_MATCHERS, ...WEAK_ASYMMETRIC_MATCHERS].some((matcher) => matcher.name === member),
    ),
  )
  .extend("theMatchersThatDemandTheSubjectFail", () => THROW_EXPECTING_MATCHERS)
  .extend("theModifiersThatDemandARejection", () => THROW_EXPECTING_MODIFIERS)
  .extend("rejectionModifiersFiledOutsideTheChainModifiers", () =>
    [...THROW_EXPECTING_MODIFIERS].filter((modifier) => !ASSERTION_CHAIN_MODIFIERS.has(modifier)),
  )
  .extend("throwExpectingMatchersFiledAsChainModifiers", () =>
    [...THROW_EXPECTING_MATCHERS].filter((name) => ASSERTION_CHAIN_MODIFIERS.has(name)),
  )
  .extend("theTurningModifierAmongTheThrowExpectingMatchers", () =>
    THROW_EXPECTING_MATCHERS.has("not"),
  )
  .extend("theReceiversThatOnlyChangeWhenAnAssertionRuns", () => DERIVED_ASSERTION_RECEIVERS)
  .extend("theMembersThatOnlySettleHowManyAssertionsRun", () => ASSERTION_COUNT_DECLARATIONS)
  .extend("namesFiledBothAsAMatcherAndAsSomethingElse", () =>
    [...ASSERTION_CHAIN_MODIFIERS, ...DERIVED_ASSERTION_RECEIVERS].filter(
      (member) =>
        EXACT_MATCHERS.has(member) ||
        STRUCTURAL_MATCHERS.has(member) ||
        CALL_CONTRACT_MATCHERS.has(member) ||
        SNAPSHOT_MATCHERS.has(member) ||
        WEAK_MATCHERS.some((matcher) => matcher.name === member),
    ),
  );

describe("matcher-vocabulary", () => {
  it("only the two matchers that pin the whole subject count as exact", ({
    theMatchersThatPinTheWholeSubject,
  }) => {
    expect(theMatchersThatPinTheWholeSubject).toStrictEqual(new Set(["toBe", "toStrictEqual"]));
  });

  it("structural comparison covers the strict and the loose spelling of equality", ({
    theMatchersThatCompareStructures,
  }) => {
    expect(theMatchersThatCompareStructures).toStrictEqual(new Set(["toEqual", "toStrictEqual"]));
  });

  it("loose equality is exact enough to compare structures", ({
    looseEqualityAmongTheStructuralMatchers,
  }) => {
    expect(looseEqualityAmongTheStructuralMatchers).toBe(true);
  });

  it("loose equality is too loose to count as an exact matcher", ({
    looseEqualityAmongTheExactMatchers,
  }) => {
    expect(looseEqualityAmongTheExactMatchers).toBe(false);
  });

  it("loose equality is too loose to assert with", ({ looseEqualityAmongTheWeakMatchers }) => {
    expect(looseEqualityAmongTheWeakMatchers).toBe(true);
  });

  it("every weak matcher says which part of the subject a pass leaves unverified", ({
    weakMatchersNamingNothingAsUnverified,
  }) => {
    expect(weakMatchersNamingNothingAsUnverified).toStrictEqual([]);
  });

  it("every weak matcher is filed under one of the named families", ({
    weakMatchersFiledOutsideTheNamedFamilies,
  }) => {
    expect(weakMatchersFiledOutsideTheNamedFamilies).toStrictEqual([]);
  });

  it("no matcher is both exact and weak", ({ weakMatchersThatAreAlsoExact }) => {
    expect(weakMatchersThatAreAlsoExact).toStrictEqual([]);
  });

  it("a matcher that pins how a mock was called is not weak", ({
    weakMatchersThatAlsoPinHowAMockWasCalled,
  }) => {
    expect(weakMatchersThatAlsoPinHowAMockWasCalled).toStrictEqual([]);
  });

  it("the matcher that pins the arguments a mock was called with is a call contract matcher", ({
    theArgumentPinningMatcherAmongTheCallContractMatchers,
  }) => {
    expect(theArgumentPinningMatcherAmongTheCallContractMatchers).toBe(true);
  });

  it("every matcher that records a snapshot advances the same recorded numbering", ({
    theMatchersThatRecordASnapshot,
  }) => {
    expect(theMatchersThatRecordASnapshot).toStrictEqual(
      new Set([
        "matchSnapshot",
        "toMatchFileSnapshot",
        "toMatchInlineSnapshot",
        "toMatchSnapshot",
        "toThrowErrorMatchingInlineSnapshot",
        "toThrowErrorMatchingSnapshot",
      ]),
    );
  });

  it("the one spelling a redundant matcher points at is itself not redundant", ({
    redundantMatchersPointingAtAnotherRedundantSpelling,
  }) => {
    expect(redundantMatchersPointingAtAnotherRedundantSpelling).toStrictEqual([]);
  });

  it("the members that only turn an assertion around are named apart", ({
    theMembersThatOnlyTurnAnAssertionAround,
  }) => {
    expect(theMembersThatOnlyTurnAnAssertionAround).toStrictEqual(
      new Set(["not", "rejects", "resolves"]),
    );
  });

  it("the members that only turn an assertion around are not matchers themselves", ({
    chainModifiersFiledAsMatchersThemselves,
  }) => {
    expect(chainModifiersFiledAsMatchersThemselves).toStrictEqual([]);
  });

  it("every matcher that demands the subject fail is named", ({
    theMatchersThatDemandTheSubjectFail,
  }) => {
    expect(theMatchersThatDemandTheSubjectFail).toStrictEqual(
      new Set([
        "toThrow",
        "toThrowError",
        "toThrowErrorMatchingInlineSnapshot",
        "toThrowErrorMatchingSnapshot",
      ]),
    );
  });

  it("a rejection is demanded by a chain modifier rather than by a matcher of its own", ({
    theModifiersThatDemandARejection,
  }) => {
    expect(theModifiersThatDemandARejection).toStrictEqual(new Set(["rejects"]));
  });

  it("the modifier that demands a rejection is filed among the chain modifiers", ({
    rejectionModifiersFiledOutsideTheChainModifiers,
  }) => {
    expect(rejectionModifiersFiledOutsideTheChainModifiers).toStrictEqual([]);
  });

  it("turning an assertion around leaves the matcher that demands the failure spelled the same", ({
    throwExpectingMatchersFiledAsChainModifiers,
  }) => {
    expect(throwExpectingMatchersFiledAsChainModifiers).toStrictEqual([]);
  });

  it("the member that turns an assertion around is not a matcher that demands the subject fail", ({
    theTurningModifierAmongTheThrowExpectingMatchers,
  }) => {
    expect(theTurningModifierAmongTheThrowExpectingMatchers).toBe(false);
  });

  it("the receivers that only change when an assertion runs are named apart", ({
    theReceiversThatOnlyChangeWhenAnAssertionRuns,
  }) => {
    expect(theReceiversThatOnlyChangeWhenAnAssertionRuns).toStrictEqual(new Set(["poll", "soft"]));
  });

  it("the members that only settle how many assertions must run are named apart", ({
    theMembersThatOnlySettleHowManyAssertionsRun,
  }) => {
    expect(theMembersThatOnlySettleHowManyAssertionsRun).toStrictEqual(
      new Set(["assertions", "hasAssertions"]),
    );
  });

  it("no name is filed both as a matcher and as something that is not one", ({
    namesFiledBothAsAMatcherAndAsSomethingElse,
  }) => {
    expect(namesFiledBothAsAMatcherAndAsSomethingElse).toStrictEqual([]);
  });
});
