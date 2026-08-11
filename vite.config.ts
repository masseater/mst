import {
  oxlint as dontReviewItOxlint,
  oxlintCli as dontReviewItOxlintCli,
  withGitExcludes,
} from "@mst/dont-review-it";
import { oxlint as lintRuleAuthoringOxlint } from "@mst/lint-rule-authoring";
import { oxlint as verifiedSpecificationsOxlint } from "@mst/verified-specifications";
import { defineConfig } from "vite-plus";

const dontReviewItBaseRuleIds = new Set(Object.keys(dontReviewItOxlint.rules ?? {}));

const dontReviewItCliOnlyRules = Object.fromEntries(
  Object.entries(dontReviewItOxlintCli.rules ?? {}).filter(
    ([ruleId]) => !dontReviewItBaseRuleIds.has(ruleId),
  ),
);

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
      "vite-plus/prefer-vite-plus-imports": "error",
      "vitest/consistent-test-filename": ["error", { pattern: "\\.test\\.tsx?$" }],
      "dont-review-it/no-default-export--use-named-export": [
        "error",
        { toolRequiredFileNames: ["plugin.ts", "vite.config.ts"] },
      ],
      "dont-review-it/no-reassign--use-spread-or-iife": [
        "error",
        { assignOnlyTargets: ["RuleTester.describe", "RuleTester.it", "RuleTester.itOnly"] },
      ],
    },
    overrides: [
      {
        files: ["packages/dont-review-it/**"],
        rules: dontReviewItCliOnlyRules,
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
      {
        files: ["apps/website/src/**"],
        rules: {
          "dont-review-it/no-array-mutation--derive-new-array": "off",
          "dont-review-it/no-reassign--use-spread-or-iife": "off",
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
