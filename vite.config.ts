import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: dontReviewItPreset.fmt(),
  lint: dontReviewItPreset.lint({
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "vitest/consistent-test-filename": ["error", { pattern: "\\.test\\.tsx?$" }],
      "dont-review-it/no-default-export--use-named-export": [
        "error",
        { toolRequiredFileNames: ["knip.ts", "plugin.ts", "vite.config.ts"] },
      ],
      "dont-review-it/no-reassign--use-spread-or-iife": [
        "error",
        { assignOnlyTargets: ["RuleTester.describe", "RuleTester.it", "RuleTester.itOnly"] },
      ],
      "dont-review-it/no-array-mutation--derive-new-array": "error",
      "dont-review-it/no-receiver-mutation--derive-new-value": "error",
      "dont-review-it/no-class-as-mutable-cell--decide-in-an-iife": "error",
      "dont-review-it/no-promise-chain--use-async-await": "error",
      "dont-review-it/no-floating-promise--await-the-result": "error",
      "dont-review-it/no-blanket-suppression--name-and-record": "error",
      "dont-review-it/no-partial-rule-set--enable-the-whole-set": "error",
      "dont-review-it/no-empty-catch--throw-or-handle": "error",
      "dont-review-it/no-silent-catch--rethrow-or-handle": "error",
      "dont-review-it/no-version-range--pin-the-exact-version": "error",
    },
    overrides: [
      {
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
        },
      },
      {
        files: ["**/{test,tests,__tests__,spec,__specs__}/**"],
        rules: {
          "vitest/consistent-test-filename": [
            "error",
            { pattern: "place-the-test-file-next-to-its-source-instead-of-a-test-directory" },
          ],
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  }),
  test: {
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
