import { describe, expect, test } from "vite-plus/test";

import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
} from "./forbidden-ambiguous-names.ts";

const BAG_WORDS_ON_THEIR_OWN: readonly string[] = ["outcome", "result"];

const BAG_WORDS_AS_SUFFIX: readonly string[] = ["queryOutcome", "parseResult", "validation_result"];

const WHOLE_NAME_WORDS: readonly string[] = [
  "val",
  "vals",
  "value",
  "values",
  "res",
  "ret",
  "data",
  "actual",
];

const SHOUTED_NAMES: readonly string[] = ["Data", "VALUES", "parsedRESULT"];

const NAMES_KEEPING_A_SUBJECT: readonly string[] = [
  "interval",
  "defaultValue",
  "metadata",
  "dataset",
  "resource",
  "retry",
  "actualCount",
];

const NAMES_LEADING_WITH_A_BAG_WORD: readonly string[] = ["resultCount", "outcomeLabel"];

const it = test
  .extend("verdictsOnBagWordsOnTheirOwn", () =>
    BAG_WORDS_ON_THEIR_OWN.map((name) =>
      createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
    ))
  .extend("verdictsOnBagWordsAsSuffix", () =>
    BAG_WORDS_AS_SUFFIX.map((name) => createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name)),
  )
  .extend("verdictsOnWholeNameWords", () =>
    WHOLE_NAME_WORDS.map((name) => createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name)),
  )
  .extend("verdictsOnShoutedNames", () =>
    SHOUTED_NAMES.map((name) => createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name)),
  )
  .extend("verdictsOnNamesKeepingASubject", () =>
    NAMES_KEEPING_A_SUBJECT.map((name) =>
      createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
    ),
  )
  .extend("verdictsOnNamesLeadingWithABagWord", () =>
    NAMES_LEADING_WITH_A_BAG_WORD.map((name) =>
      createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
    ),
  )
  .extend("verdictUnderEmptyVocabulary", () => createForbiddenNameMatcher([])("data"));

describe("forbidden-ambiguous-names", () => {
  it("a word meaning a bag of consequences is forbidden on its own", ({
    verdictsOnBagWordsOnTheirOwn,
  }) => {
    expect(verdictsOnBagWordsOnTheirOwn).toStrictEqual([true, true]);
  });

  it("a word meaning a bag of consequences is forbidden as a suffix too", ({
    verdictsOnBagWordsAsSuffix,
  }) => {
    expect(verdictsOnBagWordsAsSuffix).toStrictEqual([true, true, true]);
  });

  it("an abbreviation or a container word is forbidden as the whole name", ({
    verdictsOnWholeNameWords,
  }) => {
    expect(verdictsOnWholeNameWords).toStrictEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("matching ignores the case the name was written in", ({ verdictsOnShoutedNames }) => {
    expect(verdictsOnShoutedNames).toStrictEqual([true, true, true]);
  });

  it("a name that only contains a container word keeps its subject", ({
    verdictsOnNamesKeepingASubject,
  }) => {
    expect(verdictsOnNamesKeepingASubject).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("a bag word that is not at the end leaves room for a subject", ({
    verdictsOnNamesLeadingWithABagWord,
  }) => {
    expect(verdictsOnNamesLeadingWithABagWord).toStrictEqual([false, false]);
  });

  it("an empty vocabulary forbids nothing", ({ verdictUnderEmptyVocabulary }) => {
    expect(verdictUnderEmptyVocabulary).toBe(false);
  });
});
