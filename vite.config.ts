import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: dontReviewItPreset.fmt(),
  lint: dontReviewItPreset.lint({
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": LINT_SEVERITY.ERROR,
    },
    overrides: [
      {
        files: [
          "packages/ai-native/**",
          "packages/lint-rule-authoring/**",
          "packages/verified-specifications/**",
        ],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
        },
      },
    ],
  }),
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
