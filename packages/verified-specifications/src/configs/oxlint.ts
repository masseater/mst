import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig, type OxlintConfig } from "oxlint";

const SPEC_FILES = ["**/*.spec.ts", "**/*.spec.tsx"];

const SPEC_DIRECTORIES = ["**/specs/**"];

const SPEC_FILE_NAME_PATTERN = String.raw`\.spec\.tsx?$`;

const SPEC_DESCRIBE_DEPTH = 1;

/** @public */
export const oxlint: OxlintConfig = defineConfig({
  overrides: [
    {
      files: SPEC_DIRECTORIES,
      rules: {
        "vitest/consistent-test-filename": [
          LINT_SEVERITY.ERROR,
          { pattern: SPEC_FILE_NAME_PATTERN },
        ],
        "dont-review-it/no-detached-test-file--move-beside-source": LINT_SEVERITY.OFF,
      },
    },
    {
      files: SPEC_FILES,
      rules: {
        "vitest/max-nested-describe": [LINT_SEVERITY.ERROR, { max: SPEC_DESCRIBE_DEPTH }],
      },
    },
  ],
});
