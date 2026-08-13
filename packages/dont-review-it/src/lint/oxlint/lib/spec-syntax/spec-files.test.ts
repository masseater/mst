import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPEC_FILE_SUFFIXES,
  isSpecFile,
  specFileSuffixesFrom,
  specStemOf,
} from "./spec-files.ts";

describe("DEFAULT_SPEC_FILE_SUFFIXES", () => {
  describe("the spelling the rule carries when the repository says nothing", () => {
    const it = test.extend("carriedSuffixes", () => DEFAULT_SPEC_FILE_SUFFIXES);

    it("is the one the repository already enforces", ({ carriedSuffixes }) => {
      expect(carriedSuffixes).toStrictEqual([".test.ts", ".test.tsx"]);
    });
  });
});

describe("isSpecFile", () => {
  describe("a file carrying the spec suffix", () => {
    const it = test.extend("verdict", () =>
      isSpecFile("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("is a spec", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a file carrying the component spec suffix", () => {
    const it = test.extend("verdict", () =>
      isSpecFile("/repo/src/order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES));

    it("is a spec", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a file carrying no spec suffix", () => {
    const it = test.extend("verdict", () =>
      isSpecFile("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("is not a spec", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a file carrying a suffix the repository does not spell", () => {
    const it = test.extend("verdict", () =>
      isSpecFile("/repo/src/order.spec.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("is not a spec", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a directory named like a spec suffix", () => {
    const it = test.extend("verdict", () =>
      isSpecFile("/repo/order.test.ts/order.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("does not make the files below it specs", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});

describe("specStemOf", () => {
  describe("a spec addressed with forward slashes", () => {
    const it = test.extend("stem", () =>
      specStemOf("/repo/src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("names the source it belongs to through the stem in front of its suffix", ({ stem }) => {
      expect(stem).toBe("order");
    });
  });

  describe("a spec addressed with backslashes", () => {
    const it = test.extend("stem", () =>
      specStemOf("C:\\repo\\src\\order.test.tsx", DEFAULT_SPEC_FILE_SUFFIXES));

    it("names the same stem", ({ stem }) => {
      expect(stem).toBe("order");
    });
  });

  describe("a file that is not a spec", () => {
    const it = test.extend("stem", () =>
      specStemOf("/repo/src/order.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("names no stem", ({ stem }) => {
      expect(stem).toBe(null);
    });
  });

  describe("a name that two of the spelled suffixes both fit", () => {
    const it = test.extend("stem", () =>
      specStemOf("/repo/src/order.browser.test.ts", [".test.ts", ".browser.test.ts"]));

    it("ends the stem where the longest suffix that fits begins", ({ stem }) => {
      expect(stem).toBe("order");
    });
  });
});

describe("specFileSuffixesFrom", () => {
  describe("a rule run without settings", () => {
    const it = test.extend("suffixes", () => specFileSuffixesFrom([]));

    it("reads the spelling the rule itself carries", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    });
  });

  describe("a rule run with settings that spell nothing", () => {
    const it = test.extend("suffixes", () => specFileSuffixesFrom([{}]));

    it("keeps the rule's own spelling", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    });
  });

  describe("a rule run with a severity alone", () => {
    const it = test.extend("suffixes", () => specFileSuffixesFrom(["error"]));

    it("keeps the rule's own spelling", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    });
  });

  describe("a repository that spells its specs differently", () => {
    const it = test.extend("suffixes", () =>
      specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts"] }]));

    it("replaces the spelling entirely", ({ suffixes }) => {
      expect(suffixes).toStrictEqual([".spec.ts"]);
    });
  });

  describe("an empty spelling list", () => {
    const it = test.extend("suffixes", () => specFileSuffixesFrom([{ specFileSuffixes: [] }]));

    it("leaves the rule's own spelling in place", ({ suffixes }) => {
      expect(suffixes).toStrictEqual(DEFAULT_SPEC_FILE_SUFFIXES);
    });
  });

  describe("a spelling list holding entries that are not spellings", () => {
    const it = test.extend("suffixes", () =>
      specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", 7] }]));

    it("drops those entries from the configured list", ({ suffixes }) => {
      expect(suffixes).toStrictEqual([".spec.ts"]);
    });
  });
});
