import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPEC_FILE_SUFFIXES,
  isSpecFile,
  specFileSuffixesFrom,
  specStemOf,
} from "./spec-files.ts";

const it = test
  .extend("verdictOnSuffixedFile", () =>
    isSpecFile("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES))
  .extend("verdictOnComponentSuffixedFile", () =>
    isSpecFile("/repo/src/order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("verdictOnPlainSource", () =>
    isSpecFile("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("verdictOnForeignSuffix", () =>
    isSpecFile("/repo/src/order.spec.ts", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("verdictOnFileUnderSuffixedDirectory", () =>
    isSpecFile("/repo/order.test.ts/order.ts", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("stemOfPosixSpec", () =>
    specStemOf("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("stemOfWindowsSpec", () =>
    specStemOf("C:\\repo\\src\\order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES),
  )
  .extend("stemOfPlainSource", () => specStemOf("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES))
  .extend("stemUnderLongestMatchingSuffix", () =>
    specStemOf("/repo/src/order.browser.test.ts", [".test.ts", ".browser.test.ts"]),
  )
  .extend("suffixesReadWithoutSettings", () => specFileSuffixesFrom([]))
  .extend("suffixesReadFromEmptySettings", () => specFileSuffixesFrom([{}]))
  .extend("suffixesReadFromSeverityOnly", () => specFileSuffixesFrom(["error"]))
  .extend("suffixesReadFromReplacedSpelling", () =>
    specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts"] }]),
  )
  .extend("suffixesReadFromEmptyList", () => specFileSuffixesFrom([{ specFileSuffixes: [] }]))
  .extend("suffixesReadFromMixedList", () =>
    specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", 7] }]),
  );

describe("spec-files", () => {
  it("the spelling a spec file carries by default is the one the repository already enforces", () => {
    expect(DEFAULT_SPEC_FILE_SUFFIXES).toStrictEqual([".test.ts", ".test.tsx"]);
  });

  it("a file carrying the spec suffix is a spec", ({ verdictOnSuffixedFile }) => {
    expect(verdictOnSuffixedFile).toBe(true);
  });

  it("a file carrying the component spec suffix is a spec", ({
    verdictOnComponentSuffixedFile,
  }) => {
    expect(verdictOnComponentSuffixedFile).toBe(true);
  });

  it("a file carrying no spec suffix is not a spec", ({ verdictOnPlainSource }) => {
    expect(verdictOnPlainSource).toBe(false);
  });

  it("a file carrying a suffix the repository does not spell is not a spec", ({
    verdictOnForeignSuffix,
  }) => {
    expect(verdictOnForeignSuffix).toBe(false);
  });

  it("a directory named like a spec suffix does not make its files specs", ({
    verdictOnFileUnderSuffixedDirectory,
  }) => {
    expect(verdictOnFileUnderSuffixedDirectory).toBe(false);
  });

  it("a spec names the source it belongs to through the stem in front of its suffix", ({
    stemOfPosixSpec,
  }) => {
    expect(stemOfPosixSpec).toBe("order");
  });

  it("a spec addressed with backslashes names the same stem", ({ stemOfWindowsSpec }) => {
    expect(stemOfWindowsSpec).toBe("order");
  });

  it("a file that is not a spec names no stem", ({ stemOfPlainSource }) => {
    expect(stemOfPlainSource).toBe(null);
  });

  it("the longest suffix that fits decides where the stem ends", ({
    stemUnderLongestMatchingSuffix,
  }) => {
    expect(stemUnderLongestMatchingSuffix).toBe("order");
  });

  it("a rule run without settings reads the spelling the rule itself carries", ({
    suffixesReadWithoutSettings,
  }) => {
    expect(suffixesReadWithoutSettings).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
  });

  it("a rule run with settings that spell nothing keeps the rule's own spelling", ({
    suffixesReadFromEmptySettings,
  }) => {
    expect(suffixesReadFromEmptySettings).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
  });

  it("a rule run with a severity alone keeps the rule's own spelling", ({
    suffixesReadFromSeverityOnly,
  }) => {
    expect(suffixesReadFromSeverityOnly).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
  });

  it("a repository that spells its specs differently replaces the spelling entirely", ({
    suffixesReadFromReplacedSpelling,
  }) => {
    expect(suffixesReadFromReplacedSpelling).toStrictEqual([".spec.ts"]);
  });

  it("an empty spelling list leaves the rule's own spelling in place", ({
    suffixesReadFromEmptyList,
  }) => {
    expect(suffixesReadFromEmptyList).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
  });

  it("entries that are not spellings are dropped from the configured list", ({
    suffixesReadFromMixedList,
  }) => {
    expect(suffixesReadFromMixedList).toStrictEqual([".spec.ts"]);
  });
});
