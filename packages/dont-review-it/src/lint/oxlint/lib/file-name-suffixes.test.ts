import { describe, expect, test } from "vite-plus/test";

import {
  baseNameOf,
  configuredSuffixesFrom,
  longestMatchingSuffix,
  stemBefore,
} from "./file-name-suffixes.ts";

const CARRIED_SUFFIXES: readonly string[] = [".assets.ts"];

const ASSETS_OPTION_NAME = "assetsFileSuffixes";

const it = test
  .extend("nameAfterPosixSeparator", () => baseNameOf("/repo/src/order.assets.ts"))
  .extend("nameAfterWindowsSeparator", () => baseNameOf("C:\\repo\\src\\order.assets.ts"))
  .extend("nameWithoutAnySeparator", () => baseNameOf("order.assets.ts"))
  .extend("nameOfEmptyPath", () => baseNameOf(""))
  .extend("suffixOfDirectoryCarryingIt", () =>
    longestMatchingSuffix("/repo/order.assets.ts/plain.ts", CARRIED_SUFFIXES),
  )
  .extend("suffixOfNameCarryingIt", () =>
    longestMatchingSuffix("/repo/order.assets.ts", CARRIED_SUFFIXES),
  )
  .extend("suffixChosenFromShortestFirst", () =>
    longestMatchingSuffix("/repo/order.browser.assets.ts", [".assets.ts", ".browser.assets.ts"]),
  )
  .extend("suffixChosenFromLongestFirst", () =>
    longestMatchingSuffix("/repo/order.browser.assets.ts", [".browser.assets.ts", ".assets.ts"]),
  )
  .extend("stemInFrontOfSuffix", () => stemBefore("/repo/src/order.assets.ts", ".assets.ts"))
  .extend("suffixesReadWithoutSettings", () =>
    configuredSuffixesFrom([], { optionName: ASSETS_OPTION_NAME, carried: CARRIED_SUFFIXES }),
  )
  .extend("suffixesReadFromEmptySettings", () =>
    configuredSuffixesFrom([{}], { optionName: ASSETS_OPTION_NAME, carried: CARRIED_SUFFIXES }),
  )
  .extend("suffixesReadFromSeverityOnly", () =>
    configuredSuffixesFrom(["error"], {
      optionName: ASSETS_OPTION_NAME,
      carried: CARRIED_SUFFIXES,
    }),
  )
  .extend("suffixesReadFromListedSettings", () =>
    configuredSuffixesFrom([[".assets.ts"]], {
      optionName: ASSETS_OPTION_NAME,
      carried: CARRIED_SUFFIXES,
    }),
  )
  .extend("suffixesReadFromSingleSpelling", () =>
    configuredSuffixesFrom([{ assetsFileSuffixes: ".assets.ts" }], {
      optionName: ASSETS_OPTION_NAME,
      carried: CARRIED_SUFFIXES,
    }),
  )
  .extend("suffixesReadFromMixedList", () =>
    configuredSuffixesFrom([{ assetsFileSuffixes: [".fixtures.ts", 7] }], {
      optionName: ASSETS_OPTION_NAME,
      carried: CARRIED_SUFFIXES,
    }),
  )
  .extend("suffixesReadFromEmptyList", () =>
    configuredSuffixesFrom([{ assetsFileSuffixes: [] }], {
      optionName: ASSETS_OPTION_NAME,
      carried: CARRIED_SUFFIXES,
    }),
  );

describe("file-name-suffixes", () => {
  it("the name a path ends in is read after the last forward separator", ({
    nameAfterPosixSeparator,
  }) => {
    expect(nameAfterPosixSeparator).toBe("order.assets.ts");
  });

  it("the name a path ends in is read after the last backward separator", ({
    nameAfterWindowsSeparator,
  }) => {
    expect(nameAfterWindowsSeparator).toBe("order.assets.ts");
  });

  it("a path carrying no separator is the name itself", ({ nameWithoutAnySeparator }) => {
    expect(nameWithoutAnySeparator).toBe("order.assets.ts");
  });

  it("a path that ends in a separator names nothing", ({ nameOfEmptyPath }) => {
    expect(nameOfEmptyPath).toBe("");
  });

  it("the suffix a name carries is matched against the name rather than the path", ({
    suffixOfDirectoryCarryingIt,
  }) => {
    expect(suffixOfDirectoryCarryingIt).toBe(null);
  });

  it("a name that ends in the suffix carries it", ({ suffixOfNameCarryingIt }) => {
    expect(suffixOfNameCarryingIt).toBe(".assets.ts");
  });

  it("the longest suffix that fits is the one that matches, whatever the order", ({
    suffixChosenFromShortestFirst,
  }) => {
    expect(suffixChosenFromShortestFirst).toBe(".browser.assets.ts");
  });

  it("the longest suffix that fits stays chosen when it is written first", ({
    suffixChosenFromLongestFirst,
  }) => {
    expect(suffixChosenFromLongestFirst).toBe(".browser.assets.ts");
  });

  it("the stem is what the name carries in front of its suffix", ({ stemInFrontOfSuffix }) => {
    expect(stemInFrontOfSuffix).toBe("order");
  });

  it("a run without settings reads the spelling the rule itself carries", ({
    suffixesReadWithoutSettings,
  }) => {
    expect(suffixesReadWithoutSettings).toStrictEqual(CARRIED_SUFFIXES);
  });

  it("settings that spell nothing leave the rule's own spelling in place", ({
    suffixesReadFromEmptySettings,
  }) => {
    expect(suffixesReadFromEmptySettings).toStrictEqual(CARRIED_SUFFIXES);
  });

  it("a severity alone leaves the rule's own spelling in place", ({
    suffixesReadFromSeverityOnly,
  }) => {
    expect(suffixesReadFromSeverityOnly).toStrictEqual(CARRIED_SUFFIXES);
  });

  it("settings written as a list leave the rule's own spelling in place", ({
    suffixesReadFromListedSettings,
  }) => {
    expect(suffixesReadFromListedSettings).toStrictEqual(CARRIED_SUFFIXES);
  });

  it("a spelling written as one string leaves the rule's own spelling in place", ({
    suffixesReadFromSingleSpelling,
  }) => {
    expect(suffixesReadFromSingleSpelling).toStrictEqual(CARRIED_SUFFIXES);
  });

  it("a repository that spells its files differently replaces the spelling entirely", ({
    suffixesReadFromMixedList,
  }) => {
    expect(suffixesReadFromMixedList).toStrictEqual([".fixtures.ts"]);
  });

  it("an empty spelling list leaves the rule's own spelling in place", ({
    suffixesReadFromEmptyList,
  }) => {
    expect(suffixesReadFromEmptyList).toStrictEqual(CARRIED_SUFFIXES);
  });
});
