import { describe, expect, test } from "vite-plus/test";

import {
  ASSERTION_CHAIN_MODIFIERS,
  ASSERTION_COUNT_DECLARATIONS,
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

describe("EXACT_MATCHERS", () => {
  describe("the matchers that pin the whole subject", () => {
    const it = test.extend("theMatchersThatPinTheWholeSubject", () => EXACT_MATCHERS);

    it("are the only two that count as exact", ({ theMatchersThatPinTheWholeSubject }) => {
      expect(theMatchersThatPinTheWholeSubject).toStrictEqual(new Set(["toBe", "toStrictEqual"]));
    });
  });

  describe("loose equality", () => {
    const it = test.extend("looseEqualityAmongTheExactMatchers", () =>
      EXACT_MATCHERS.has("toEqual"));

    it("is too loose to count as an exact matcher", ({ looseEqualityAmongTheExactMatchers }) => {
      expect(looseEqualityAmongTheExactMatchers).toBe(false);
    });
  });
});

describe("STRUCTURAL_MATCHERS", () => {
  describe("the matchers that compare structures", () => {
    const it = test.extend("theMatchersThatCompareStructures", () => STRUCTURAL_MATCHERS);

    it("cover the strict and the loose spelling of equality", ({
      theMatchersThatCompareStructures,
    }) => {
      expect(theMatchersThatCompareStructures).toStrictEqual(new Set(["toEqual", "toStrictEqual"]));
    });
  });

  describe("loose equality", () => {
    const it = test.extend("looseEqualityAmongTheStructuralMatchers", () =>
      STRUCTURAL_MATCHERS.has("toEqual"));

    it("is exact enough to compare structures", ({ looseEqualityAmongTheStructuralMatchers }) => {
      expect(looseEqualityAmongTheStructuralMatchers).toBe(true);
    });
  });
});

describe("UNVERIFIED_REGION_BY_WEAK_MATCHER", () => {
  describe("loose equality", () => {
    const it = test.extend("looseEqualityAmongTheWeakMatchers", () =>
      UNVERIFIED_REGION_BY_WEAK_MATCHER.has("toEqual"));

    it("is too loose to assert with", ({ looseEqualityAmongTheWeakMatchers }) => {
      expect(looseEqualityAmongTheWeakMatchers).toBe(true);
    });
  });

  describe("every weak matcher", () => {
    const it = test.extend("weakMatchersNamingNothingAsUnverified", () =>
      [
        ...UNVERIFIED_REGION_BY_WEAK_MATCHER.values(),
        ...UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.values(),
      ].filter((unverified) => unverified.trim() === ""));

    it("says which part of the subject a pass leaves unverified", ({
      weakMatchersNamingNothingAsUnverified,
    }) => {
      expect(weakMatchersNamingNothingAsUnverified).toStrictEqual([]);
    });
  });

  describe("a weak matcher", () => {
    const it = test.extend("theRegionAWeakMatcherLeavesAlone", () =>
      UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toMatchObject"));

    it("names the region a pass left alone", ({ theRegionAWeakMatcherLeavesAlone }) => {
      expect(theRegionAWeakMatcherLeavesAlone).toBe(
        "every property the subject carries that the expected object does not name",
      );
    });
  });

  describe("an exact matcher", () => {
    const it = test
      .extend("theRegionAnExactMatcherLeavesAlone", () =>
        UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toStrictEqual"))
      .extend("weakMatchersThatAreAlsoExact", () =>
        [...UNVERIFIED_REGION_BY_WEAK_MATCHER.keys()].filter((name) => EXACT_MATCHERS.has(name)),
      );

    it("names no unverified region", ({ theRegionAnExactMatcherLeavesAlone }) => {
      expect(theRegionAnExactMatcherLeavesAlone).toBe(undefined);
    });

    it("is filed nowhere among the weak matchers", ({ weakMatchersThatAreAlsoExact }) => {
      expect(weakMatchersThatAreAlsoExact).toStrictEqual([]);
    });
  });

  describe("a matcher that pins how a mock was called", () => {
    const it = test
      .extend("theRegionACallContractMatcherLeavesAlone", () =>
        UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toHaveBeenCalledWith"))
      .extend("weakMatchersThatAlsoPinHowAMockWasCalled", () =>
        [...UNVERIFIED_REGION_BY_WEAK_MATCHER.keys()].filter((name) =>
          CALL_CONTRACT_MATCHERS.has(name),
        ),
      );

    it("names no unverified region", ({ theRegionACallContractMatcherLeavesAlone }) => {
      expect(theRegionACallContractMatcherLeavesAlone).toBe(undefined);
    });

    it("is filed nowhere among the weak matchers", ({
      weakMatchersThatAlsoPinHowAMockWasCalled,
    }) => {
      expect(weakMatchersThatAlsoPinHowAMockWasCalled).toStrictEqual([]);
    });
  });

  describe("an asymmetric matcher", () => {
    const it = test.extend("anAsymmetricMatcherAmongTheChainEndingMatchers", () =>
      UNVERIFIED_REGION_BY_WEAK_MATCHER.has("stringContaining"));

    it("is named apart from the matchers a chain ends with", ({
      anAsymmetricMatcherAmongTheChainEndingMatchers,
    }) => {
      expect(anAsymmetricMatcherAmongTheChainEndingMatchers).toBe(false);
    });
  });
});

describe("UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER", () => {
  describe("a weak asymmetric matcher", () => {
    const it = test.extend("theRegionAWeakAsymmetricMatcherLeavesAlone", () =>
      UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.get("stringContaining"));

    it("names the region a pass left alone as well", ({
      theRegionAWeakAsymmetricMatcherLeavesAlone,
    }) => {
      expect(theRegionAWeakAsymmetricMatcherLeavesAlone).toBe(
        "every character of the subject outside the expected substring",
      );
    });
  });

  describe("a matcher a chain ends with", () => {
    const it = test.extend("aChainEndingMatcherAmongTheAsymmetricMatchers", () =>
      UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.has("toMatchObject"));

    it("is named apart from the asymmetric matchers", ({
      aChainEndingMatcherAmongTheAsymmetricMatchers,
    }) => {
      expect(aChainEndingMatcherAmongTheAsymmetricMatchers).toBe(false);
    });
  });
});

describe("CANONICAL_SPELLING_BY_REDUNDANT_MATCHER", () => {
  describe("a second spelling of a comparison against nothing", () => {
    const it = test.extend("theOneSpellingForASecondSpellingOfNothing", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeNull"));

    it("names the one spelling to write", ({ theOneSpellingForASecondSpellingOfNothing }) => {
      expect(theOneSpellingForASecondSpellingOfNothing).toBe("toBe(null)");
    });
  });

  describe("a second spelling of a comparison against absence", () => {
    const it = test.extend("theOneSpellingForASecondSpellingOfAbsence", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeUndefined"));

    it("names the one spelling to write", ({ theOneSpellingForASecondSpellingOfAbsence }) => {
      expect(theOneSpellingForASecondSpellingOfAbsence).toBe("toBe(undefined)");
    });
  });

  describe("a second spelling of a comparison against not-a-number", () => {
    const it = test.extend("theOneSpellingForASecondSpellingOfNotANumber", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeNaN"));

    it("names the one spelling to write", ({ theOneSpellingForASecondSpellingOfNotANumber }) => {
      expect(theOneSpellingForASecondSpellingOfNotANumber).toBe("toBe(Number.NaN)");
    });
  });

  describe("a second spelling of a call-contract matcher", () => {
    const it = test.extend("theOneSpellingForASecondSpellingOfACallContractMatcher", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBeCalledWith"));

    it("names the one spelling to write", ({
      theOneSpellingForASecondSpellingOfACallContractMatcher,
    }) => {
      expect(theOneSpellingForASecondSpellingOfACallContractMatcher).toBe("toHaveBeenCalledWith()");
    });
  });

  describe("a matcher spelled the one way", () => {
    const it = test.extend("theOneSpellingForAMatcherAlreadySpelledTheOneWay", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toBe"));

    it("names nothing to write instead", ({ theOneSpellingForAMatcherAlreadySpelledTheOneWay }) => {
      expect(theOneSpellingForAMatcherAlreadySpelledTheOneWay).toBe(undefined);
    });
  });

  describe("a call-contract matcher spelled the one way", () => {
    const it = test.extend("theOneSpellingForACallContractMatcherAlreadySpelledTheOneWay", () =>
      CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.get("toHaveBeenCalledWith"));

    it("names nothing to write instead either", ({
      theOneSpellingForACallContractMatcherAlreadySpelledTheOneWay,
    }) => {
      expect(theOneSpellingForACallContractMatcherAlreadySpelledTheOneWay).toBe(undefined);
    });
  });

  describe("the one spelling a redundant matcher points at", () => {
    const it = test.extend("redundantMatchersPointingAtAnotherRedundantSpelling", () =>
      [...CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.values()].filter((writeInstead) =>
        [...CANONICAL_SPELLING_BY_REDUNDANT_MATCHER.keys()].some((name) =>
          writeInstead.startsWith(`${name}(`),
        ),
      ));

    it("is itself not redundant", ({ redundantMatchersPointingAtAnotherRedundantSpelling }) => {
      expect(redundantMatchersPointingAtAnotherRedundantSpelling).toStrictEqual([]);
    });
  });
});

describe("CALL_CONTRACT_MATCHERS", () => {
  describe("the matcher that pins the arguments a mock was called with", () => {
    const it = test.extend("theArgumentPinningMatcherAmongTheCallContractMatchers", () =>
      CALL_CONTRACT_MATCHERS.has("toHaveBeenCalledWith"));

    it("is a call contract matcher", ({
      theArgumentPinningMatcherAmongTheCallContractMatchers,
    }) => {
      expect(theArgumentPinningMatcherAmongTheCallContractMatchers).toBe(true);
    });
  });
});

describe("SNAPSHOT_MATCHERS", () => {
  describe("every matcher that records a snapshot", () => {
    const it = test.extend("theMatchersThatRecordASnapshot", () => SNAPSHOT_MATCHERS);

    it("advances the same recorded numbering", ({ theMatchersThatRecordASnapshot }) => {
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
  });
});

describe("ASSERTION_CHAIN_MODIFIERS", () => {
  describe("the members that only turn an assertion around", () => {
    const it = test
      .extend("theMembersThatOnlyTurnAnAssertionAround", () => ASSERTION_CHAIN_MODIFIERS)
      .extend("chainModifiersFiledAsMatchersThemselves", () =>
        [...ASSERTION_CHAIN_MODIFIERS].filter(
          (member) =>
            EXACT_MATCHERS.has(member) ||
            UNVERIFIED_REGION_BY_WEAK_MATCHER.has(member) ||
            UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.has(member),
        ),
      );

    it("are named apart", ({ theMembersThatOnlyTurnAnAssertionAround }) => {
      expect(theMembersThatOnlyTurnAnAssertionAround).toStrictEqual(
        new Set(["not", "rejects", "resolves"]),
      );
    });

    it("are not matchers themselves", ({ chainModifiersFiledAsMatchersThemselves }) => {
      expect(chainModifiersFiledAsMatchersThemselves).toStrictEqual([]);
    });
  });

  describe("the members filed as chain modifiers and as derived receivers", () => {
    const it = test.extend("namesFiledBothAsAMatcherAndAsSomethingElse", () =>
      [...ASSERTION_CHAIN_MODIFIERS, ...DERIVED_ASSERTION_RECEIVERS].filter(
        (member) =>
          EXACT_MATCHERS.has(member) ||
          STRUCTURAL_MATCHERS.has(member) ||
          CALL_CONTRACT_MATCHERS.has(member) ||
          SNAPSHOT_MATCHERS.has(member) ||
          UNVERIFIED_REGION_BY_WEAK_MATCHER.has(member),
      ));

    it("hold no name that is filed as a matcher as well", ({
      namesFiledBothAsAMatcherAndAsSomethingElse,
    }) => {
      expect(namesFiledBothAsAMatcherAndAsSomethingElse).toStrictEqual([]);
    });
  });
});

describe("THROW_EXPECTING_MATCHERS", () => {
  describe("every matcher that demands the subject fail", () => {
    const it = test.extend("theMatchersThatDemandTheSubjectFail", () => THROW_EXPECTING_MATCHERS);

    it("is named", ({ theMatchersThatDemandTheSubjectFail }) => {
      expect(theMatchersThatDemandTheSubjectFail).toStrictEqual(
        new Set([
          "toThrow",
          "toThrowError",
          "toThrowErrorMatchingInlineSnapshot",
          "toThrowErrorMatchingSnapshot",
        ]),
      );
    });
  });

  describe("turning an assertion around", () => {
    const it = test.extend("throwExpectingMatchersFiledAsChainModifiers", () =>
      [...THROW_EXPECTING_MATCHERS].filter((name) => ASSERTION_CHAIN_MODIFIERS.has(name)));

    it("leaves the matcher that demands the failure spelled the same", ({
      throwExpectingMatchersFiledAsChainModifiers,
    }) => {
      expect(throwExpectingMatchersFiledAsChainModifiers).toStrictEqual([]);
    });
  });

  describe("the member that turns an assertion around", () => {
    const it = test.extend("theTurningModifierAmongTheThrowExpectingMatchers", () =>
      THROW_EXPECTING_MATCHERS.has("not"));

    it("is not a matcher that demands the subject fail", ({
      theTurningModifierAmongTheThrowExpectingMatchers,
    }) => {
      expect(theTurningModifierAmongTheThrowExpectingMatchers).toBe(false);
    });
  });
});

describe("THROW_EXPECTING_MODIFIERS", () => {
  describe("a rejection", () => {
    const it = test.extend("theModifiersThatDemandARejection", () => THROW_EXPECTING_MODIFIERS);

    it("is demanded by a chain modifier rather than by a matcher of its own", ({
      theModifiersThatDemandARejection,
    }) => {
      expect(theModifiersThatDemandARejection).toStrictEqual(new Set(["rejects"]));
    });
  });

  describe("the modifier that demands a rejection", () => {
    const it = test.extend("rejectionModifiersFiledOutsideTheChainModifiers", () =>
      [...THROW_EXPECTING_MODIFIERS].filter(
        (modifier) => !ASSERTION_CHAIN_MODIFIERS.has(modifier),
      ));

    it("is filed among the chain modifiers", ({
      rejectionModifiersFiledOutsideTheChainModifiers,
    }) => {
      expect(rejectionModifiersFiledOutsideTheChainModifiers).toStrictEqual([]);
    });
  });
});

describe("DERIVED_ASSERTION_RECEIVERS", () => {
  describe("the receivers that only change when an assertion runs", () => {
    const it = test.extend("theReceiversThatOnlyChangeWhenAnAssertionRuns", () =>
      DERIVED_ASSERTION_RECEIVERS);

    it("are named apart", ({ theReceiversThatOnlyChangeWhenAnAssertionRuns }) => {
      expect(theReceiversThatOnlyChangeWhenAnAssertionRuns).toStrictEqual(
        new Set(["poll", "soft"]),
      );
    });
  });
});

describe("ASSERTION_COUNT_DECLARATIONS", () => {
  describe("the members that only settle how many assertions must run", () => {
    const it = test.extend("theMembersThatOnlySettleHowManyAssertionsRun", () =>
      ASSERTION_COUNT_DECLARATIONS);

    it("are named apart", ({ theMembersThatOnlySettleHowManyAssertionsRun }) => {
      expect(theMembersThatOnlySettleHowManyAssertionsRun).toStrictEqual(
        new Set(["assertions", "hasAssertions"]),
      );
    });
  });
});
