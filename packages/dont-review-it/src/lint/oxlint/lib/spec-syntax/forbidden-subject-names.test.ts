import { describe, expect, test } from "vite-plus/test";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../forbidden-ambiguous-names.ts";
import { forbiddenSubjectNamesFrom } from "./forbidden-subject-names.ts";

describe("forbidden-subject-names", () => {
  test("a rule run without settings carries no vocabulary of its own", () => {
    expect(forbiddenSubjectNamesFrom([])).toStrictEqual([]);
    expect(forbiddenSubjectNamesFrom([{}])).toStrictEqual([]);
    expect(forbiddenSubjectNamesFrom(["error"])).toStrictEqual([]);
    expect(forbiddenSubjectNamesFrom([[{ pattern: "^data$" }]])).toStrictEqual([]);
  });

  test("the vocabulary the deployment injects is the vocabulary the rule reads", () => {
    expect(
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [{ pattern: "^data$" }] }]),
    ).toStrictEqual([{ pattern: "^data$" }]);
  });

  test("the list every naming rule shares is read back whole", () => {
    expect(
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [...FORBIDDEN_AMBIGUOUS_NAMES] }]),
    ).toStrictEqual([...FORBIDDEN_AMBIGUOUS_NAMES]);
  });

  test("an empty vocabulary stays empty", () => {
    expect(forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [] }])).toStrictEqual([]);
  });

  test("a vocabulary spelled as something other than a list is read as no vocabulary", () => {
    expect(forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: "^data$" }])).toStrictEqual([]);
  });

  test("entries that spell no pattern are dropped from the configured vocabulary", () => {
    expect(
      forbiddenSubjectNamesFrom([
        { forbiddenSubjectNames: [{ pattern: "^data$" }, { pattern: 7 }, "result$", null] },
      ]),
    ).toStrictEqual([{ pattern: "^data$" }]);
  });
});
