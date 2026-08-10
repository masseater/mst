import * as dontReviewIt from "@mst/dont-review-it";
import * as lintRuleAuthoring from "@mst/lint-rule-authoring";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    extends: [lintRuleAuthoring.oxlint, dontReviewIt.oxlint],
    plugins: ["unicorn", "typescript", "oxc", "vitest"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "vitest/consistent-test-filename": ["error", { pattern: "\\.test\\.tsx?$" }],
    },
    overrides: [
      {
        files: ["**/{test,tests,__tests__,spec,specs,__specs__}/**"],
        rules: {
          "vitest/consistent-test-filename": [
            "error",
            { pattern: "place-the-test-file-next-to-its-source-instead-of-a-test-directory" },
          ],
        },
      },
      {
        files: ["apps/website/src/**"],
        rules: {
          "dont-review-it/no-array-mutation--derive-new-array": "off",
          "dont-review-it/no-reassign--use-spread-or-iife": "off",
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
