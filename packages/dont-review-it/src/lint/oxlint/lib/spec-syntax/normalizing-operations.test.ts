import { describe, expect, test } from "vite-plus/test";

import { normalizingFunctionsFrom } from "./normalizing-operations.ts";

const DEFAULTS = new Set(["orderBy", "reduceAsync", "sortBy", "uniq", "uniqBy", "uniqWith"]);
describe("normalizing operations", () => {
  test("a rule configured with nothing reads the vocabulary the rule carries", () => {
    expect(normalizingFunctionsFrom([])).toStrictEqual(DEFAULTS);
  });

  test("a configuration that is not a settings object leaves the carried vocabulary standing", () => {
    expect(normalizingFunctionsFrom(["error"])).toStrictEqual(DEFAULTS);
  });

  test("a configuration spelled as a list leaves the carried vocabulary standing", () => {
    expect(normalizingFunctionsFrom([["orderBy"]])).toStrictEqual(DEFAULTS);
  });

  test("a configuration spelled as nothing leaves the carried vocabulary standing", () => {
    expect(normalizingFunctionsFrom([null])).toStrictEqual(DEFAULTS);
  });

  test("a settings object without the entry leaves the carried vocabulary standing", () => {
    expect(normalizingFunctionsFrom([{ specFileSuffixes: [".spec.ts"] }])).toStrictEqual(DEFAULTS);
  });

  test("a listed vocabulary replaces the one the rule carries", () => {
    expect(normalizingFunctionsFrom([{ normalizingFunctions: ["reshape"] }])).toStrictEqual(
      new Set(["reshape"]),
    );
  });

  test("an entry that is not a name is not a name this reading can use", () => {
    expect(normalizingFunctionsFrom([{ normalizingFunctions: ["reshape", 7] }])).toStrictEqual(
      new Set(["reshape"]),
    );
  });

  test("an emptied vocabulary leaves only the operations the language spells out", () => {
    expect(normalizingFunctionsFrom([{ normalizingFunctions: [] }])).toStrictEqual(new Set());
  });
});
