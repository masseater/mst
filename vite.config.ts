import { fileURLToPath } from "node:url";

import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: dontReviewItPreset.fmt(),
  lint: dontReviewItPreset.lint({
    bundles: "all",
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": LINT_SEVERITY.ERROR,
      "vitest/consistent-test-filename": [LINT_SEVERITY.ERROR, { pattern: "\\.test\\.tsx?$" }],
      "dont-review-it/no-default-export--use-named-export": [
        LINT_SEVERITY.ERROR,
        { toolRequiredFileNames: ["knip.ts", "plugin.ts", "vite.config.ts", "vitest-sdk.ts"] },
      ],
      "dont-review-it/no-reassign--use-spread-or-iife": [
        LINT_SEVERITY.ERROR,
        { assignOnlyTargets: ["RuleTester.describe", "RuleTester.it", "RuleTester.itOnly"] },
      ],
      "dont-review-it/no-array-mutation--derive-new-array": LINT_SEVERITY.ERROR,
      "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.ERROR,
      "dont-review-it/no-class-as-mutable-cell--decide-in-an-iife": LINT_SEVERITY.ERROR,
      "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.ERROR,
      "dont-review-it/no-floating-promise--await-the-result": LINT_SEVERITY.ERROR,
      "dont-review-it/no-blanket-suppression--name-and-record": LINT_SEVERITY.ERROR,
      "dont-review-it/no-partial-rule-set--enable-the-whole-set": LINT_SEVERITY.ERROR,
      "dont-review-it/no-empty-catch--throw-or-handle": LINT_SEVERITY.ERROR,
      "dont-review-it/no-silent-catch--rethrow-or-handle": LINT_SEVERITY.ERROR,
      "dont-review-it/no-non-boundary-double--replace-at-the-external-boundary": [
        LINT_SEVERITY.ERROR,
        {
          externalIoPackages: [
            "@mst/ai-native/telemetry",
            "@opentelemetry/exporter-logs-otlp-http",
            "@opentelemetry/exporter-metrics-otlp-http",
            "@opentelemetry/exporter-trace-otlp-http",
          ],
        },
      ],
    },
    overrides: [
      {
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
        },
      },
      {
        files: ["packages/dont-review-it/src/lint/oxlint/**"],
        rules: {
          "typescript/switch-exhaustiveness-check": [
            LINT_SEVERITY.ERROR,
            { considerDefaultExhaustiveForUnions: true },
          ],
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
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@mst/ai-native/vitest-sdk")),
      },
    },
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
