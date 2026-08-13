import { oxlint as dontReviewItOxlint, withGitExcludes } from "@mst/dont-review-it";
import { LINT_SEVERITY, oxlint as lintRuleAuthoringOxlint } from "@mst/lint-rule-authoring";
import { oxlint as verifiedSpecificationsOxlint } from "@mst/verified-specifications";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: withGitExcludes({
    sortImports: {
      customGroups: [
        { groupName: "typeBuiltin", selector: "type", elementNamePattern: ["node:*"] },
        { groupName: "typeRepository", selector: "type", elementNamePattern: ["./**", "../**"] },
        { groupName: "typeInstalled", selector: "type" },
      ],
      groups: [
        "builtin",
        "external",
        ["internal", "subpath", "parent", "sibling", "index"],
        "typeBuiltin",
        { newlinesBetween: false },
        "typeInstalled",
        { newlinesBetween: false },
        "typeRepository",
      ],
    },
  }),
  lint: withGitExcludes({
    extends: [lintRuleAuthoringOxlint, dontReviewItOxlint, verifiedSpecificationsOxlint],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": LINT_SEVERITY.ERROR,
      "vitest/consistent-test-filename": [LINT_SEVERITY.ERROR, { pattern: "\\.test\\.tsx?$" }],
      "dont-review-it/no-default-export--use-named-export": [
        LINT_SEVERITY.ERROR,
        { toolRequiredFileNames: ["knip.ts", "plugin.ts", "vite.config.ts"] },
      ],
      "dont-review-it/no-reassign--use-spread-or-iife": [
        LINT_SEVERITY.ERROR,
        { assignOnlyTargets: ["RuleTester.describe", "RuleTester.it", "RuleTester.itOnly"] },
      ],
      "dont-review-it/no-version-range--pin-the-exact-version": LINT_SEVERITY.ERROR,
    },
    overrides: [
      {
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
        },
      },
      {
        files: ["**/{test,tests,__tests__,spec,__specs__}/**"],
        rules: {
          "vitest/consistent-test-filename": [
            LINT_SEVERITY.ERROR,
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
  },
});
