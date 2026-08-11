import { describe, expect, test } from "vite-plus/test";

import { listedUnder } from "./option-lists.ts";

describe("declared-replacements/option-lists", () => {
  test("options nobody wrote carry no entries", () => {
    expect(listedUnder([], "declared")).toStrictEqual([]);
  });

  test("an option written as something other than an object carries no entries", () => {
    expect(listedUnder(["declared"], "declared")).toStrictEqual([]);
  });

  test("an option written as nothing carries no entries", () => {
    expect(listedUnder([null], "declared")).toStrictEqual([]);
  });

  test("an option written as a list carries no entries under a key", () => {
    expect(listedUnder([[]], "declared")).toStrictEqual([]);
  });

  test("a key written as something other than a list carries no entries", () => {
    expect(listedUnder([{ declared: "lerna" }], "declared")).toStrictEqual([]);
  });

  test("a key nobody wrote carries no entries", () => {
    expect(listedUnder([{ withdrawn: [] }], "declared")).toStrictEqual([]);
  });

  test("entries written as objects come back as they stand", () => {
    expect(listedUnder([{ declared: [{ name: "lerna" }] }], "declared")).toStrictEqual([
      { name: "lerna" },
    ]);
  });

  test("entries written as anything but an object are left out", () => {
    expect(
      listedUnder([{ declared: ["lerna", null, [], { name: "gulp" }] }], "declared"),
    ).toStrictEqual([{ name: "gulp" }]);
  });
});
