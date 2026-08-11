import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPEC_FILE_SUFFIXES,
  isSpecFile,
  specFileSuffixesFrom,
  specStemOf,
} from "./spec-files.ts";

describe("spec-files", () => {
  test("the spelling a spec file carries by default is the one the repository already enforces", () => {
    expect(DEFAULT_SPEC_FILE_SUFFIXES).toStrictEqual([".test.ts", ".test.tsx"]);
  });

  test("a file carrying the spec suffix is a spec", () => {
    expect(isSpecFile("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(true);
    expect(isSpecFile("/repo/src/order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(true);
  });

  test("a file carrying no spec suffix is not a spec", () => {
    expect(isSpecFile("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(false);
    expect(isSpecFile("/repo/src/order.spec.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(false);
  });

  test("a directory named like a spec suffix does not make its files specs", () => {
    expect(isSpecFile("/repo/order.test.ts/order.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(false);
  });

  test("a spec names the source it belongs to through the stem in front of its suffix", () => {
    expect(specStemOf("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe("order");
    expect(specStemOf("C:\\repo\\src\\order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES)).toBe("order");
  });

  test("a file that is not a spec names no stem", () => {
    expect(specStemOf("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe(null);
  });

  test("the longest suffix that fits decides where the stem ends", () => {
    expect(specStemOf("/repo/src/order.browser.test.ts", [".test.ts", ".browser.test.ts"])).toBe(
      "order",
    );
  });

  test("a rule run without settings reads the spelling the rule itself carries", () => {
    expect(specFileSuffixesFrom([])).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    expect(specFileSuffixesFrom([{}])).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    expect(specFileSuffixesFrom(["error"])).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
  });

  test("a repository that spells its specs differently replaces the spelling entirely", () => {
    expect(specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts"] }])).toStrictEqual([".spec.ts"]);
  });

  test("an empty spelling list leaves the rule's own spelling in place", () => {
    expect(specFileSuffixesFrom([{ specFileSuffixes: [] }])).toStrictEqual(
      DEFAULT_SPEC_FILE_SUFFIXES,
    );
  });

  test("entries that are not spellings are dropped from the configured list", () => {
    expect(specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", 7] }])).toStrictEqual([
      ".spec.ts",
    ]);
  });
});
