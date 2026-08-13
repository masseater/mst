import { describe, expect, test } from "vite-plus/test";

import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
} from "./forbidden-ambiguous-names.ts";

describe("createForbiddenNameMatcher", () => {
  describe("a word meaning a bag of consequences, standing on its own", () => {
    const it = test.extend("verdicts", () =>
      ["outcome", "result"].map((name) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true]);
    });
  });

  describe("a word meaning a bag of consequences, standing at the end of a name", () => {
    const it = test.extend("verdicts", () =>
      ["queryOutcome", "parseResult", "validation_result"].map((name) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is forbidden as a suffix too", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("an abbreviation or a container word standing as the whole name", () => {
    const it = test.extend("verdicts", () =>
      ["val", "vals", "value", "values", "res", "ret", "data", "actual"].map((name) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true, true, true, true, true]);
    });
  });

  describe("a forbidden name shouted in another case", () => {
    const it = test.extend("verdicts", () =>
      ["Data", "VALUES", "parsedRESULT"].map((name) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is forbidden all the same, because matching ignores the case it was written in", ({
      verdicts,
    }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("a name that only contains a container word", () => {
    const it = test.extend("verdicts", () =>
      ["interval", "defaultValue", "metadata", "dataset", "resource", "retry", "actualCount"].map(
        (name) => createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is allowed, because it keeps its subject", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false, false, false, false, false, false]);
    });
  });

  describe("a name opening with a bag word instead of ending in one", () => {
    const it = test.extend("verdicts", () =>
      ["resultCount", "outcomeLabel"].map((name) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(name),
      ));

    it("is allowed, because it leaves room for a subject", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false]);
    });
  });

  describe("a name read against an empty vocabulary", () => {
    const it = test.extend("verdict", () => createForbiddenNameMatcher([])("data"));

    it("is allowed, because an empty vocabulary forbids nothing", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
