import { describe, expect, test } from "vite-plus/test";

import { listedUnder } from "./option-lists.ts";

const it = test
  .extend("entriesOfEmptyOptions", () => listedUnder([], "declared"))
  .extend("entriesOfTextOption", () => listedUnder(["declared"], "declared"))
  .extend("entriesOfMissingOption", () => listedUnder([null], "declared"))
  .extend("entriesOfListedOption", () => listedUnder([[]], "declared"))
  .extend("entriesOfTextKey", () => listedUnder([{ declared: "lerna" }], "declared"))
  .extend("entriesOfUnwrittenKey", () => listedUnder([{ withdrawn: [] }], "declared"))
  .extend("entriesOfObjectRows", () => listedUnder([{ declared: [{ name: "lerna" }] }], "declared"))
  .extend("entriesOfMixedRows", () =>
    listedUnder([{ declared: ["lerna", null, [], { name: "gulp" }] }], "declared"),
  );

describe("declared-replacements/option-lists", () => {
  it("options nobody wrote carry no entries", ({ entriesOfEmptyOptions }) => {
    expect(entriesOfEmptyOptions).toStrictEqual([]);
  });

  it("an option written as something other than an object carries no entries", ({
    entriesOfTextOption,
  }) => {
    expect(entriesOfTextOption).toStrictEqual([]);
  });

  it("an option written as nothing carries no entries", ({ entriesOfMissingOption }) => {
    expect(entriesOfMissingOption).toStrictEqual([]);
  });

  it("an option written as a list carries no entries under a key", ({ entriesOfListedOption }) => {
    expect(entriesOfListedOption).toStrictEqual([]);
  });

  it("a key written as something other than a list carries no entries", ({ entriesOfTextKey }) => {
    expect(entriesOfTextKey).toStrictEqual([]);
  });

  it("a key nobody wrote carries no entries", ({ entriesOfUnwrittenKey }) => {
    expect(entriesOfUnwrittenKey).toStrictEqual([]);
  });

  it("entries written as objects come back as they stand", ({ entriesOfObjectRows }) => {
    expect(entriesOfObjectRows).toStrictEqual([{ name: "lerna" }]);
  });

  it("entries written as anything but an object are left out", ({ entriesOfMixedRows }) => {
    expect(entriesOfMixedRows).toStrictEqual([{ name: "gulp" }]);
  });
});
