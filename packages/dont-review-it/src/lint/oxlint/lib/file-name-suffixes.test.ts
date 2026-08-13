import { describe, expect, test } from "vite-plus/test";

import {
  baseNameOf,
  configuredSuffixesFrom,
  longestMatchingSuffix,
  stemBefore,
} from "./file-name-suffixes.ts";

const CARRIED_SUFFIXES: readonly string[] = [".assets.ts"];

const ASSETS_OPTION_NAME = "assetsFileSuffixes";

describe("baseNameOf", () => {
  describe("a path written on the forward separator", () => {
    const it = test.extend("baseName", () => baseNameOf("/repo/src/order.assets.ts"));

    it("reads the name the path ends in after the last separator", ({ baseName }) => {
      expect(baseName).toBe("order.assets.ts");
    });
  });

  describe("a path written on the backward separator", () => {
    const it = test.extend("baseName", () => baseNameOf("C:\\repo\\src\\order.assets.ts"));

    it("reads the name the path ends in after the last separator", ({ baseName }) => {
      expect(baseName).toBe("order.assets.ts");
    });
  });

  describe("a path carrying no separator at all", () => {
    const it = test.extend("baseName", () => baseNameOf("order.assets.ts"));

    it("is the name itself", ({ baseName }) => {
      expect(baseName).toBe("order.assets.ts");
    });
  });

  describe("a path that ends in a separator", () => {
    const it = test.extend("baseName", () => baseNameOf(""));

    it("names nothing", ({ baseName }) => {
      expect(baseName).toBe("");
    });
  });
});

describe("longestMatchingSuffix", () => {
  describe("a path whose directory carries the suffix", () => {
    const it = test.extend("suffix", () =>
      longestMatchingSuffix("/repo/order.assets.ts/plain.ts", CARRIED_SUFFIXES));

    it("matches the suffix against the name rather than the path", ({ suffix }) => {
      expect(suffix).toBe(null);
    });
  });

  describe("a name that ends in the suffix", () => {
    const it = test.extend("suffix", () =>
      longestMatchingSuffix("/repo/order.assets.ts", CARRIED_SUFFIXES));

    it("carries it", ({ suffix }) => {
      expect(suffix).toBe(".assets.ts");
    });
  });

  describe("a name fitting two suffixes written shortest first", () => {
    const it = test.extend("suffix", () =>
      longestMatchingSuffix("/repo/order.browser.assets.ts", [".assets.ts", ".browser.assets.ts"]));

    it("matches the longest of the two", ({ suffix }) => {
      expect(suffix).toBe(".browser.assets.ts");
    });
  });

  describe("a name fitting two suffixes written longest first", () => {
    const it = test.extend("suffix", () =>
      longestMatchingSuffix("/repo/order.browser.assets.ts", [".browser.assets.ts", ".assets.ts"]));

    it("keeps the longest of the two chosen", ({ suffix }) => {
      expect(suffix).toBe(".browser.assets.ts");
    });
  });
});

describe("stemBefore", () => {
  describe("a name carrying a suffix", () => {
    const it = test.extend("stem", () => stemBefore("/repo/src/order.assets.ts", ".assets.ts"));

    it("is what the name carries in front of its suffix", ({ stem }) => {
      expect(stem).toBe("order");
    });
  });
});

describe("configuredSuffixesFrom", () => {
  describe("a run without settings", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([], { optionName: ASSETS_OPTION_NAME, carried: CARRIED_SUFFIXES }));

    it("reads the spelling the rule itself carries", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });

  describe("settings that spell nothing", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([{}], { optionName: ASSETS_OPTION_NAME, carried: CARRIED_SUFFIXES }));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });

  describe("a severity written alone", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom(["error"], {
        optionName: ASSETS_OPTION_NAME,
        carried: CARRIED_SUFFIXES,
      }));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });

  describe("settings written as a list", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([[".assets.ts"]], {
        optionName: ASSETS_OPTION_NAME,
        carried: CARRIED_SUFFIXES,
      }));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });

  describe("a spelling written as one string", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([{ assetsFileSuffixes: ".assets.ts" }], {
        optionName: ASSETS_OPTION_NAME,
        carried: CARRIED_SUFFIXES,
      }));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });

  describe("a repository that spells its files differently", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([{ assetsFileSuffixes: [".fixtures.ts", 7] }], {
        optionName: ASSETS_OPTION_NAME,
        carried: CARRIED_SUFFIXES,
      }));

    it("replaces the spelling entirely", ({ suffixes }) => {
      expect(suffixes).toStrictEqual([".fixtures.ts"]);
    });
  });

  describe("an empty spelling list", () => {
    const it = test.extend("suffixes", () =>
      configuredSuffixesFrom([{ assetsFileSuffixes: [] }], {
        optionName: ASSETS_OPTION_NAME,
        carried: CARRIED_SUFFIXES,
      }));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(CARRIED_SUFFIXES);
    });
  });
});
