import { describe, expect, test } from "vite-plus/test";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../forbidden-ambiguous-names.ts";
import { forbiddenSubjectNamesFrom } from "./forbidden-subject-names.ts";

const it = test
  .extend("vocabularyReadWithoutSettings", () => forbiddenSubjectNamesFrom([]))
  .extend("vocabularyReadFromEmptySettings", () => forbiddenSubjectNamesFrom([{}]))
  .extend("vocabularyReadFromSeverityOnly", () => forbiddenSubjectNamesFrom(["error"]))
  .extend("vocabularyReadFromListedSettings", () =>
    forbiddenSubjectNamesFrom([[{ pattern: "^data$" }]]),
  )
  .extend("vocabularyReadFromInjectedPatterns", () =>
    forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [{ pattern: "^data$" }] }]),
  )
  .extend("vocabularyReadFromTheSharedList", () =>
    forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [...FORBIDDEN_AMBIGUOUS_NAMES] }]),
  )
  .extend("vocabularyReadFromEmptyList", () =>
    forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [] }]),
  )
  .extend("vocabularyReadFromUnlistedPatterns", () =>
    forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: "^data$" }]),
  )
  .extend("vocabularyReadFromMixedEntries", () =>
    forbiddenSubjectNamesFrom([
      { forbiddenSubjectNames: [{ pattern: "^data$" }, { pattern: 7 }, "result$", null] },
    ]),
  );

describe("forbidden-subject-names", () => {
  it("a rule run without settings carries no vocabulary of its own", ({
    vocabularyReadWithoutSettings,
  }) => {
    expect(vocabularyReadWithoutSettings).toStrictEqual([]);
  });

  it("settings that spell nothing carry no vocabulary", ({ vocabularyReadFromEmptySettings }) => {
    expect(vocabularyReadFromEmptySettings).toStrictEqual([]);
  });

  it("a severity alone carries no vocabulary", ({ vocabularyReadFromSeverityOnly }) => {
    expect(vocabularyReadFromSeverityOnly).toStrictEqual([]);
  });

  it("settings written as a list carry no vocabulary", ({ vocabularyReadFromListedSettings }) => {
    expect(vocabularyReadFromListedSettings).toStrictEqual([]);
  });

  it("the vocabulary the deployment injects is the vocabulary the rule reads", ({
    vocabularyReadFromInjectedPatterns,
  }) => {
    expect(vocabularyReadFromInjectedPatterns).toStrictEqual([{ pattern: "^data$" }]);
  });

  it("the list every naming rule shares is read back whole", ({
    vocabularyReadFromTheSharedList,
  }) => {
    expect(vocabularyReadFromTheSharedList).toStrictEqual([...FORBIDDEN_AMBIGUOUS_NAMES]);
  });

  it("an empty vocabulary stays empty", ({ vocabularyReadFromEmptyList }) => {
    expect(vocabularyReadFromEmptyList).toStrictEqual([]);
  });

  it("a vocabulary spelled as something other than a list is read as no vocabulary", ({
    vocabularyReadFromUnlistedPatterns,
  }) => {
    expect(vocabularyReadFromUnlistedPatterns).toStrictEqual([]);
  });

  it("entries that spell no pattern are dropped from the configured vocabulary", ({
    vocabularyReadFromMixedEntries,
  }) => {
    expect(vocabularyReadFromMixedEntries).toStrictEqual([{ pattern: "^data$" }]);
  });
});
