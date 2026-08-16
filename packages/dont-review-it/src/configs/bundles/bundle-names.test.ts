import { describe, expect, test } from "vite-plus/test";

import { LINT_BUNDLE, LINT_BUNDLE_NAMES, selectedLintBundles } from "./bundle-names.ts";

describe("selectedLintBundles", () => {
  describe("a selection asking for every bundle", () => {
    const it = test.extend("selection", () => selectedLintBundles("all"));

    it("names every bundle the package declares", ({ selection }) => {
      expect(selection).toStrictEqual(LINT_BUNDLE_NAMES);
    });
  });

  describe("a selection naming nothing", () => {
    const it = test.extend("selection", () => selectedLintBundles([]));

    it("still names the bundle that cannot be left out", ({ selection }) => {
      expect(selection).toStrictEqual([LINT_BUNDLE.governance]);
    });
  });

  describe("a selection naming the bundle that cannot be left out", () => {
    const it = test.extend("selection", () => selectedLintBundles([LINT_BUNDLE.governance]));

    it("names it once", ({ selection }) => {
      expect(selection).toStrictEqual([LINT_BUNDLE.governance]);
    });
  });

  describe("a selection naming one bundle of its own", () => {
    const it = test.extend("selection", () => selectedLintBundles([LINT_BUNDLE.testing]));

    it("names it behind the bundle that cannot be left out", ({ selection }) => {
      expect(selection).toStrictEqual([LINT_BUNDLE.governance, LINT_BUNDLE.testing]);
    });
  });
});
