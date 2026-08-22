import { describe, expect, test } from "vite-plus/test";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../forbidden-ambiguous-names.ts";
import { forbiddenSubjectNamesFrom } from "./forbidden-subject-names.ts";

describe("forbiddenSubjectNamesFrom", () => {
  describe("a rule run without settings", () => {
    const it = test.extend("vocabulary", () => forbiddenSubjectNamesFrom([]));

    it("carries no vocabulary of its own", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("settings that spell nothing", () => {
    const it = test.extend("vocabulary", () => forbiddenSubjectNamesFrom([{}]));

    it("carry no vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("a severity alone", () => {
    const it = test.extend("vocabulary", () => forbiddenSubjectNamesFrom(["error"]));

    it("carries no vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("settings written as a list", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([[{ pattern: "^data$" }]]));

    it("carry no vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("the vocabulary the deployment injects", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [{ pattern: "^data$" }] }]));

    it("is the vocabulary the rule reads", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([{ pattern: "^data$" }]);
    });
  });

  describe("the list every naming rule shares", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [...FORBIDDEN_AMBIGUOUS_NAMES] }]));

    it("is read back whole", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([...FORBIDDEN_AMBIGUOUS_NAMES]);
    });
  });

  describe("an empty vocabulary", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: [] }]));

    it("stays empty", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("a vocabulary spelled as something other than a list", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([{ forbiddenSubjectNames: "^data$" }]));

    it("is read as no vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("entries that spell no pattern", () => {
    const it = test.extend("vocabulary", () =>
      forbiddenSubjectNamesFrom([
        { forbiddenSubjectNames: [{ pattern: "^data$" }, { pattern: 7 }, "result$", null] },
      ]));

    it("are dropped from the configured vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([{ pattern: "^data$" }]);
    });
  });
});
