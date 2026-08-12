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

const it = test
  .extend("vocabularyOfEmptyOptions", () => normalizingFunctionsFrom([]))
  .extend("vocabularyOfSeverityOnlyOptions", () => normalizingFunctionsFrom(["error"]))
  .extend("vocabularyOfListedOptions", () => normalizingFunctionsFrom([["orderBy"]]))
  .extend("vocabularyOfMissingOptions", () => normalizingFunctionsFrom([null]))
  .extend("vocabularyOfForeignSettings", () =>
    normalizingFunctionsFrom([{ specFileSuffixes: [".spec.ts"] }]),
  )
  .extend("vocabularyOfListedNames", () =>
    normalizingFunctionsFrom([{ normalizingFunctions: ["reshape"] }]),
  )
  .extend("vocabularyOfPartlyNamedEntries", () =>
    normalizingFunctionsFrom([{ normalizingFunctions: ["reshape", 7] }]),
  )
  .extend("vocabularyOfEmptiedNames", () =>
    normalizingFunctionsFrom([{ normalizingFunctions: [] }]),
  );

describe("normalizing operations", () => {
  it("a rule configured with nothing reads the vocabulary the rule carries", ({
    vocabularyOfEmptyOptions,
  }) => {
    expect(vocabularyOfEmptyOptions).toStrictEqual(CARRIED_FUNCTIONS);
  });

  it("a configuration that is not a settings object leaves the carried vocabulary standing", ({
    vocabularyOfSeverityOnlyOptions,
  }) => {
    expect(vocabularyOfSeverityOnlyOptions).toStrictEqual(CARRIED_FUNCTIONS);
  });

  it("a configuration spelled as a list leaves the carried vocabulary standing", ({
    vocabularyOfListedOptions,
  }) => {
    expect(vocabularyOfListedOptions).toStrictEqual(CARRIED_FUNCTIONS);
  });

  it("a configuration spelled as nothing leaves the carried vocabulary standing", ({
    vocabularyOfMissingOptions,
  }) => {
    expect(vocabularyOfMissingOptions).toStrictEqual(CARRIED_FUNCTIONS);
  });

  it("a settings object without the entry leaves the carried vocabulary standing", ({
    vocabularyOfForeignSettings,
  }) => {
    expect(vocabularyOfForeignSettings).toStrictEqual(CARRIED_FUNCTIONS);
  });

  it("a listed vocabulary replaces the one the rule carries", ({ vocabularyOfListedNames }) => {
    expect(vocabularyOfListedNames).toStrictEqual(new Set(["reshape"]));
  });

  it("an entry that is not a name is not a name this reading can use", ({
    vocabularyOfPartlyNamedEntries,
  }) => {
    expect(vocabularyOfPartlyNamedEntries).toStrictEqual(new Set(["reshape"]));
  });

  it("an emptied vocabulary leaves only the operations the language spells out", ({
    vocabularyOfEmptiedNames,
  }) => {
    expect(vocabularyOfEmptiedNames).toStrictEqual(new Set());
  });
});
