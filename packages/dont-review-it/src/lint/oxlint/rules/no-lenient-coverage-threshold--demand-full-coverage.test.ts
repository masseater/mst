import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noLenientCoverageThreshold } from "./no-lenient-coverage-threshold--demand-full-coverage.ts";

const FULL_THRESHOLDS =
  "{ branches: 100, functions: 100, lines: 100, statements: 100, perFile: true }";

describe("dont-review-it/no-lenient-coverage-threshold--demand-full-coverage", () => {
  testLintRule(noLenientCoverageThreshold, {
    valid: [
      {
        name: "every metric spelled out at full coverage, checked file by file, passes",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "the shorthand that demands full coverage on every metric at once passes",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: true } } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "the shorthand written as a string key passes",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { "100": true, perFile: true } } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a vitest config outside a vite-plus setup is held to the same demand",
        code: `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vitest.config.ts",
      },
      {
        name: "a config written as a plain object literal is read the same way",
        code: `export default { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\n`,
        filename: "vite.config.mts",
      },
      {
        name: "a threshold above the demanded number passes",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
      },
      {
        name: "a lowered demand is met by the number the options name",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: 90, functions: 100, lines: 100, statements: 100, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
      },
      {
        name: "the shorthand still satisfies a lowered demand",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
      },
      {
        name: "a config wrapped in parentheses is read the same way",
        code: `export default ({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a threshold wrapped in parentheses is read as the number it is",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: (100), functions: 100, lines: 100, statements: 100, perFile: true } } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a metric written with a computed string key is the metric it names",
        code: `export default { test: { coverage: { thresholds: { ["branches"]: 100, functions: 100, lines: 100, statements: 100, perFile: true } } } };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a later duplicate of the thresholds object is the one that counts",
        code: `export default { test: { coverage: { thresholds: { branches: 0 } } }, test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a file that is not a test config is never looked at",
        code: "export default { test: { coverage: {} } };\n",
        filename: "src/index.ts",
      },
      {
        name: "a name that merely ends in the config name is not a test config",
        code: "export default { test: { coverage: {} } };\n",
        filename: "src/legacy-vite.config.ts",
      },
      {
        name: "a config for a tool other than the test runner is not a test config",
        code: "export default { test: { coverage: {} } };\n",
        filename: "knip.config.ts",
      },
    ],
    invalid: [
      {
        name: "a config that says nothing about coverage is reported once",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ lint: {} });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "coverage configured without any threshold is reported once",
        code: `export default { test: { coverage: { reporter: ["text"] } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "a config with no default export cannot be read and is reported",
        code: `export const config = { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "a config assembled behind an identifier cannot be read and is reported",
        code: `const config = { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\nexport default config;\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "coverage handed over as a value that is not an object literal is reported once",
        code: `import { coverage } from "./shared.ts";\nexport default { test: { coverage } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "a full threshold checked against the package total is reported",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 } } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "aggregateCoverageThreshold" }],
      },
      {
        name: "the per-file check turned off is reported the same as leaving it out",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: false } } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "aggregateCoverageThreshold" }],
      },
      {
        name: "thresholds spread in from elsewhere cannot be read and are reported",
        code: `import { shared } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { ...shared } } } };\n`,
        filename: "vite.config.ts",
        errors: [
          { messageId: "aggregateCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
        ],
      },
      {
        name: "a metric left out is reported on its own",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { functions: 100, lines: 100, statements: 100, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsetCoverageThreshold" }],
      },
      {
        name: "a threshold that is not a plain number counts as absent",
        code: `import { branches } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { branches, functions: 100, lines: 100, statements: 100, perFile: true } } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsetCoverageThreshold" }],
      },
      {
        name: "a metric behind a computed name cannot be read and is reported",
        code: `import { metric } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { [metric]: 100, functions: 100, lines: 100, statements: 100, perFile: true } } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsetCoverageThreshold" }],
      },
      {
        name: "a metric behind a computed expression cannot be read and is reported",
        code: `import { prefix } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { [prefix + "es"]: 100, functions: 100, lines: 100, statements: 100, perFile: true } } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsetCoverageThreshold" }],
      },
      {
        name: "a config helper called with no argument at all is reported once",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig();\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "a config helper handed a spread cannot be read and is reported once",
        code: `import { defineConfig } from "vite-plus";\nimport { base } from "./shared.ts";\nexport default defineConfig(...base);\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingCoverageThresholds" }],
      },
      {
        name: "every metric below full coverage is reported one by one",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: 90, functions: 90, lines: 90, statements: 90, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        errors: [
          { messageId: "lenientCoverageThreshold" },
          { messageId: "lenientCoverageThreshold" },
          { messageId: "lenientCoverageThreshold" },
          { messageId: "lenientCoverageThreshold" },
        ],
      },
      {
        name: "the shorthand turned off leaves every metric unset",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { 100: false, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        errors: [
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
          { messageId: "unsetCoverageThreshold" },
        ],
      },
      {
        name: "a metric below a demand the options lowered is still reported",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: 80, functions: 100, lines: 100, statements: 100, perFile: true } } } });\n`,
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
        errors: [{ messageId: "lenientCoverageThreshold" }],
      },
      {
        name: "a vitest config outside a vite-plus setup is reported the same way",
        code: `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { coverage: { thresholds: { branches: 90, functions: 100, lines: 100, statements: 100, perFile: true } } } });\n`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "lenientCoverageThreshold" }],
      },
    ],
  });
});
