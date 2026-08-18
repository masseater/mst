import { describe, expect, test } from "vite-plus/test";

import { bundleNameOf, bundleNamesIn, type BundledLintRule } from "./rule-bundle.ts";

const RULE_DIRECTORIES: readonly string[] = ["src/lint/oxlint/rules"];

const plainRule: BundledLintRule = {
  bundle: null,
  name: "no-plain--decorate-it",
  relatedGuidelines: [],
  unreadableGuidelines: 0,
  description: "Disallow plainness",
  sourcePath: "src/lint/oxlint/rules/no-plain--decorate-it.ts",
  fixable: false,
  hasSuggestions: false,
  configurable: false,
  shipped: true,
  messages: [],
};

describe("bundleNameOf", () => {
  describe("a rule sitting directly under the declared rule directory", () => {
    const it = test.extend("bundle", () =>
      bundleNameOf({
        sourcePath: "src/lint/oxlint/rules/no-plain--decorate-it.ts",
        ruleDirectories: RULE_DIRECTORIES,
      }));

    it("names no bundle", ({ bundle }) => {
      expect(bundle).toBe(null);
    });
  });

  describe("a rule sitting one directory below the declared rule directory", () => {
    const it = test.extend("bundle", () =>
      bundleNameOf({
        sourcePath: "src/lint/oxlint/rules/test/no-plain--decorate-it.ts",
        ruleDirectories: RULE_DIRECTORIES,
      }));

    it("names that directory", ({ bundle }) => {
      expect(bundle).toBe("test");
    });
  });

  describe("a rule sitting deeper than one directory below", () => {
    const it = test.extend("bundle", () =>
      bundleNameOf({
        sourcePath: "src/lint/oxlint/rules/test/fixtures/no-plain--decorate-it.ts",
        ruleDirectories: RULE_DIRECTORIES,
      }));

    it("names the first directory below the declared one", ({ bundle }) => {
      expect(bundle).toBe("test");
    });
  });

  describe("a path outside every declared rule directory", () => {
    const it = test.extend("bundle", () =>
      bundleNameOf({
        sourcePath: "src/elsewhere/test/no-plain--decorate-it.ts",
        ruleDirectories: RULE_DIRECTORIES,
      }));

    it("names no bundle", ({ bundle }) => {
      expect(bundle).toBe(null);
    });
  });

  describe("a rule under the second of two declared rule directories", () => {
    const it = test.extend("bundle", () =>
      bundleNameOf({
        sourcePath: "src/lint/eslint/rules/state/no-plain--decorate-it.ts",
        ruleDirectories: ["src/lint/oxlint/rules", "src/lint/eslint/rules"],
      }));

    it("names the directory below the one that matches", ({ bundle }) => {
      expect(bundle).toBe("state");
    });
  });
});

describe("bundleNamesIn", () => {
  describe("rules naming two bundles out of order, one of them twice, beside an unbundled one", () => {
    const it = test.extend("bundleNames", () =>
      bundleNamesIn([
        { ...plainRule, bundle: "test" },
        { ...plainRule, bundle: "core" },
        { ...plainRule, bundle: "test" },
        plainRule,
      ]));

    it("lists each named bundle once in the order of the names", ({ bundleNames }) => {
      expect(bundleNames).toStrictEqual(["core", "test"]);
    });
  });
});
