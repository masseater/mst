import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireSpecDirectoryOutsideCoverage } from "./require-spec-directory-outside-coverage--exclude-it-from-the-measurement.ts";

const THRESHOLDS = "thresholds: { 100: true, perFile: true }";

describe("dont-review-it/require-spec-directory-outside-coverage--exclude-it-from-the-measurement", () => {
  testLintRule(requireSpecDirectoryOutsideCoverage, {
    valid: [
      {
        name: "a coverage block leaving the specification directory out passes",
        documented: true,
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { exclude: ["specs/**"], ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a config that never reaches a default export is left alone",
        code: `import { defineConfig } from "vite-plus";\nconst settings = defineConfig({ test: { coverage: { ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a config that measures no coverage at all is left alone",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { testTimeout: 15000 } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a file that is not a test runner config is left alone",
        code: `export default { test: { coverage: { ${THRESHOLDS} } } };\n`,
        filename: "src/settings.ts",
      },
      {
        name: "the directory the options name is the one demanded",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { exclude: ["examples/**"], ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        options: [{ pattern: "examples/**" }],
      },
    ],
    invalid: [
      {
        name: "a coverage block without an exclusion list is reported",
        documented: true,
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unmeasuredCoverageExclusion" }],
      },
      {
        name: "an exclusion list that never names the specification directory is reported",
        documented: true,
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { exclude: ["dist/**"], ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "includedSpecDirectory" }],
      },
      {
        name: "an exclusion list built from something other than written out patterns is reported",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { exclude: excluded, ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "includedSpecDirectory" }],
      },
      {
        name: "a list carrying an entry that is not written out is read past",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { exclude: [...more, 1], ${THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "includedSpecDirectory" }],
      },
    ],
  });
});
