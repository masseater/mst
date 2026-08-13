import { describe, expect, test } from "vite-plus/test";

import { normalizingFunctionsFrom } from "./normalizing-operations.ts";

const CARRIED_FUNCTIONS: ReadonlySet<string> = new Set([
  "orderBy",
  "reduceAsync",
  "sortBy",
  "uniq",
  "uniqBy",
  "uniqWith",
]);

describe("normalizingFunctionsFrom", () => {
  describe("a rule configured with nothing", () => {
    const it = test.extend("vocabulary", () => normalizingFunctionsFrom([]));

    it("reads the vocabulary the rule carries", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(CARRIED_FUNCTIONS);
    });
  });

  describe("a configuration that is not a settings object", () => {
    const it = test.extend("vocabulary", () => normalizingFunctionsFrom(["error"]));

    it("leaves the carried vocabulary standing", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(CARRIED_FUNCTIONS);
    });
  });

  describe("a configuration spelled as a list", () => {
    const it = test.extend("vocabulary", () => normalizingFunctionsFrom([["orderBy"]]));

    it("leaves the carried vocabulary standing", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(CARRIED_FUNCTIONS);
    });
  });

  describe("a configuration spelled as nothing", () => {
    const it = test.extend("vocabulary", () => normalizingFunctionsFrom([null]));

    it("leaves the carried vocabulary standing", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(CARRIED_FUNCTIONS);
    });
  });

  describe("a settings object without the entry", () => {
    const it = test.extend("vocabulary", () =>
      normalizingFunctionsFrom([{ specFileSuffixes: [".spec.ts"] }]));

    it("leaves the carried vocabulary standing", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(CARRIED_FUNCTIONS);
    });
  });

  describe("a listed vocabulary", () => {
    const it = test.extend("vocabulary", () =>
      normalizingFunctionsFrom([{ normalizingFunctions: ["reshape"] }]));

    it("replaces the one the rule carries", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(new Set(["reshape"]));
    });
  });

  describe("an entry that is not a name", () => {
    const it = test.extend("vocabulary", () =>
      normalizingFunctionsFrom([{ normalizingFunctions: ["reshape", 7] }]));

    it("is not a name this reading can use", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(new Set(["reshape"]));
    });
  });

  describe("an emptied vocabulary", () => {
    const it = test.extend("vocabulary", () =>
      normalizingFunctionsFrom([{ normalizingFunctions: [] }]));

    it("leaves only the operations the language spells out", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual(new Set());
    });
  });
});
