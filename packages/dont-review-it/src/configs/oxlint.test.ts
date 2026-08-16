import { describe, expect, test } from "vite-plus/test";

import { LINT_BUNDLE, LINT_BUNDLE_NAMES } from "./bundles/bundle-names.ts";
import { oxlintFor } from "./oxlint.ts";

describe("oxlintFor", () => {
  describe("a selection asking for every bundle", () => {
    const it = test.extend("linting", () => oxlintFor("all"));

    it("configures what naming every bundle configures", ({ linting }) => {
      expect(linting).toStrictEqual(oxlintFor([...LINT_BUNDLE_NAMES]));
    });
  });

  describe("a selection naming nothing", () => {
    const it = test.extend("linting", () => oxlintFor([]));

    it("configures what naming the bundle that cannot be left out configures", ({ linting }) => {
      expect(linting).toStrictEqual(oxlintFor([LINT_BUNDLE.governance]));
    });
  });
});
