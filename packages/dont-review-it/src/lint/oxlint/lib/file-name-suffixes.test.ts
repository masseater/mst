import { describe, expect, test } from "vite-plus/test";

import {
  baseNameOf,
  configuredSuffixesFrom,
  longestMatchingSuffix,
  stemBefore,
} from "./file-name-suffixes.ts";

const CARRIED_SUFFIXES: readonly string[] = [".assets.ts"];

describe("file-name-suffixes", () => {
  test("the name a path ends in is read after the last separator of either shape", () => {
    expect(baseNameOf("/repo/src/order.assets.ts")).toBe("order.assets.ts");
    expect(baseNameOf("C:\\repo\\src\\order.assets.ts")).toBe("order.assets.ts");
    expect(baseNameOf("order.assets.ts")).toBe("order.assets.ts");
  });

  test("a path that ends in a separator names nothing", () => {
    expect(baseNameOf("")).toBe("");
  });

  test("the suffix a name carries is matched against the name rather than the path", () => {
    expect(longestMatchingSuffix("/repo/order.assets.ts/plain.ts", CARRIED_SUFFIXES)).toBe(null);
    expect(longestMatchingSuffix("/repo/order.assets.ts", CARRIED_SUFFIXES)).toBe(".assets.ts");
  });

  test("the longest suffix that fits is the one that matches", () => {
    expect(
      longestMatchingSuffix("/repo/order.browser.assets.ts", [".assets.ts", ".browser.assets.ts"]),
    ).toBe(".browser.assets.ts");
    expect(
      longestMatchingSuffix("/repo/order.browser.assets.ts", [".browser.assets.ts", ".assets.ts"]),
    ).toBe(".browser.assets.ts");
  });

  test("the stem is what the name carries in front of its suffix", () => {
    expect(stemBefore("/repo/src/order.assets.ts", ".assets.ts")).toBe("order");
  });

  test("a run without settings reads the spelling the rule itself carries", () => {
    const carried = { optionName: "assetsFileSuffixes", carried: CARRIED_SUFFIXES };
    expect(configuredSuffixesFrom([], carried)).toStrictEqual(CARRIED_SUFFIXES);
    expect(configuredSuffixesFrom([{}], carried)).toStrictEqual(CARRIED_SUFFIXES);
    expect(configuredSuffixesFrom(["error"], carried)).toStrictEqual(CARRIED_SUFFIXES);
    expect(configuredSuffixesFrom([[".assets.ts"]], carried)).toStrictEqual(CARRIED_SUFFIXES);
    expect(configuredSuffixesFrom([{ assetsFileSuffixes: ".assets.ts" }], carried)).toStrictEqual(
      CARRIED_SUFFIXES,
    );
  });

  test("a repository that spells its files differently replaces the spelling entirely", () => {
    expect(
      configuredSuffixesFrom([{ assetsFileSuffixes: [".fixtures.ts", 7] }], {
        optionName: "assetsFileSuffixes",
        carried: CARRIED_SUFFIXES,
      }),
    ).toStrictEqual([".fixtures.ts"]);
  });

  test("an empty spelling list leaves the rule's own spelling in place", () => {
    expect(
      configuredSuffixesFrom([{ assetsFileSuffixes: [] }], {
        optionName: "assetsFileSuffixes",
        carried: CARRIED_SUFFIXES,
      }),
    ).toStrictEqual(CARRIED_SUFFIXES);
  });
});
