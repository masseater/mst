import { describe, expect, test } from "vite-plus/test";

import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
} from "./forbidden-ambiguous-names.ts";

describe("createForbiddenNameMatcher", () => {
  describe("a word meaning a bag of consequences, standing on its own", () => {
    const it = test.extend("verdicts", () =>
      ["outcome", "result"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true]);
    });
  });

  describe("a word meaning a bag of consequences, standing at the end of a name", () => {
    const it = test.extend("verdicts", () =>
      ["queryOutcome", "parseResult", "validation_result"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden as a suffix too", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("an abbreviation or a container word standing as the whole name", () => {
    const it = test.extend("verdicts", () =>
      ["val", "value", "res", "ret", "data", "actual"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true, true, true]);
    });
  });

  describe("a placeholder word standing where a subject belongs", () => {
    const it = test.extend("verdicts", () =>
      ["temp", "tmp", "foo", "dummy"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden, because it carries no subject at all", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true]);
    });
  });

  describe("a word naming the container instead of what it holds", () => {
    const it = test.extend("verdicts", () =>
      ["obj", "items", "entries", "payload", "content"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true, true]);
    });
  });

  describe("a word naming the mechanism instead of its subject", () => {
    const it = test.extend("verdicts", () =>
      ["ctx", "context", "options", "handler", "callback"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true, true]);
    });
  });

  describe("a word naming the unit of a measurement", () => {
    const it = test.extend("verdicts", () =>
      ["date", "time", "timestamp", "count"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true]);
    });
  });

  describe("a subject standing in front of a measurement word", () => {
    const it = test.extend("verdicts", () =>
      ["expiryDate", "startTime"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is allowed, because the subject keeps the name concrete", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false]);
    });
  });

  describe("a word naming an operation without its subject", () => {
    const it = test.extend("verdicts", () =>
      ["parsed", "formatted", "merged"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("a plural form of a forbidden word", () => {
    const it = test.extend("verdicts", () =>
      ["vals", "values", "targets", "bodies"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("falls with its singular", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true]);
    });
  });

  describe("a forbidden name shouted in another case", () => {
    const it = test.extend("verdicts", () =>
      ["Data", "VALUES", "parsedRESULT"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden all the same, because matching ignores the case it was written in", ({
      verdicts,
    }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("a name that only contains a container word", () => {
    const it = test.extend("verdicts", () =>
      ["interval", "defaultValue", "metadata", "dataset", "resource", "retry"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is allowed, because it keeps its subject", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false, false, false, false, false]);
    });
  });

  describe("a name opening with a bag word instead of ending in one", () => {
    const it = test.extend("verdicts", () =>
      ["resultCount", "outcomeLabel"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is allowed, because it leaves room for a subject", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false]);
    });
  });

  describe("a subject standing in front of an output word", () => {
    const it = test.extend("verdicts", () =>
      ["gitOutput", "userInfo"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is allowed, because the subject keeps the name concrete", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false]);
    });
  });

  describe("a decoration standing in front of a forbidden word", () => {
    const it = test.extend("verdicts", () =>
      ["theData", "newValue", "rawArgs", "someItems"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("does not rescue the name", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true, true]);
    });
  });

  describe("a number standing after a forbidden word", () => {
    const it = test.extend("verdicts", () =>
      ["res2", "value1"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("does not rescue the name", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true]);
    });
  });

  describe("a separator standing around a forbidden word", () => {
    const it = test.extend("verdicts", () =>
      ["_data", "$value", "__result__"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("does not rescue the name", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("a decoration standing alone as the whole name", () => {
    const it = test.extend("verdicts", () =>
      ["current", "temp"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden, because it is judged as the whole name", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, true]);
    });
  });

  describe("a subject standing after a decoration", () => {
    const it = test.extend("verdicts", () =>
      ["newPassword", "currentUser"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("survives", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([false, false]);
    });
  });

  describe("a name carrying decorations around a forbidden subject", () => {
    const it = test.extend("verdicts", () =>
      ["theNewData", "_res2", "parseResult"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is forbidden, because normalizing strips the decorations down to the subject", ({
      verdicts,
    }) => {
      expect(verdicts).toStrictEqual([true, true, true]);
    });
  });

  describe("a name with no words at all", () => {
    const it = test.extend("verdicts", () =>
      ["__", "_2"].map((spelling) =>
        createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES)(spelling),
      ));

    it("is allowed, because it is judged as nothing", ({ verdicts }) => {
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
