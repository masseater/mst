import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noLenientCoverageThreshold } from "./no-lenient-coverage-threshold--demand-full-coverage.ts";

const configFor = (thresholds: string): string =>
  `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { thresholds: ${thresholds} } } });\n`;

const FULL_THRESHOLDS =
  "{ branches: 100, functions: 100, lines: 100, statements: 100, perFile: true }";

describe("dont-review-it/no-lenient-coverage-threshold--demand-full-coverage", () => {
  testLintRule(noLenientCoverageThreshold, {
    valid: [
      {
        name: "every metric spelled out at full coverage, checked file by file, passes",
        code: configFor(FULL_THRESHOLDS),
        filename: "vite.config.ts",
      },
      {
        name: "the shorthand that demands full coverage on every metric at once passes",
        code: configFor("{ 100: true, perFile: true }"),
        filename: "vite.config.ts",
      },
      {
        name: "the shorthand written as a string key passes",
        code: configFor(`{ "100": true, perFile: true }`),
        filename: "vite.config.ts",
      },
      {
        name: "a vitest config outside a vite-plus setup is held to the same demand",
        code: `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vitest.config.ts",
      },
      {
        name: "an aliased Vite config factory is resolved",
        code: `import { defineConfig as config } from "vite";\nexport default config({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vite.config.mts",
      },
      {
        name: "a Vite Plus namespace config factory is resolved",
        code: `import * as vitePlus from "vite-plus";\nexport default vitePlus.defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a Vitest namespace config factory is resolved",
        code: `import * as vitest from "vitest/config";\nexport default vitest.defineConfig({ test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } });\n`,
        filename: "vitest.config.mts",
      },
      {
        name: "a config written as a plain object literal is read the same way",
        code: `export default { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\n`,
        filename: "vite.config.mts",
      },
      {
        name: "a threshold above the demanded number passes",
        code: configFor(FULL_THRESHOLDS),
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
      },
      {
        name: "a lowered demand is met by the number the options name",
        code: configFor(
          "{ branches: 90, functions: 100, lines: 100, statements: 100, perFile: true }",
        ),
        filename: "vite.config.ts",
        options: [{ branches: 90 }],
      },
      {
        name: "the shorthand still satisfies a lowered demand",
        code: configFor("{ 100: true, perFile: true }"),
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
        code: configFor(
          "{ branches: (100), functions: 100, lines: 100, statements: 100, perFile: true }",
        ),
        filename: "vite.config.ts",
      },
      {
        name: "TypeScript wrappers preserve config objects and threshold values",
        code: `import { defineConfig } from "vite-plus";\nexport default (defineConfig(({ test: { coverage: ({ thresholds: ({ branches: (100 as number), functions: 100, lines: 100, statements: 100, perFile: (true as boolean) } satisfies Thresholds) } as Coverage) } } satisfies Config)) satisfies Config);`,
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
      {
        name: "an authentic config factory outside the canonical filename is not selected",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: {} } });`,
        filename: "test-factory.ts",
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
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a config assembled behind an identifier cannot be read and is reported",
        code: `const config = { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };\nexport default config;\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "coverage handed over as a value that is not an object literal is reported once",
        code: `import { coverage } from "./shared.ts";\nexport default { test: { coverage } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a full threshold checked against the package total is reported",
        code: configFor("{ branches: 100, functions: 100, lines: 100, statements: 100 }"),
        filename: "vite.config.ts",
        errors: [{ messageId: "aggregateCoverageThreshold" }],
      },
      {
        name: "the per-file check turned off is reported the same as leaving it out",
        code: configFor("{ 100: true, perFile: false }"),
        filename: "vite.config.ts",
        errors: [{ messageId: "aggregateCoverageThreshold" }],
      },
      {
        name: "thresholds spread in from elsewhere cannot be read and are reported",
        code: `import { shared } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { ...shared } } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a metric left out is reported on its own",
        code: configFor("{ functions: 100, lines: 100, statements: 100, perFile: true }"),
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
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a metric behind a computed expression cannot be read and is reported",
        code: `import { prefix } from "./shared.ts";\nexport default { test: { coverage: { thresholds: { [prefix + "es"]: 100, functions: 100, lines: 100, statements: 100, perFile: true } } } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a config helper called with no argument at all is reported once",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig();\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "a config helper handed a spread cannot be read and is reported once",
        code: `import { defineConfig } from "vite-plus";\nimport { base } from "./shared.ts";\nexport default defineConfig(...base);\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
      },
      {
        name: "every metric below full coverage is reported one by one",
        code: configFor(
          "{ branches: 90, functions: 90, lines: 90, statements: 90, perFile: true }",
        ),
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
        code: configFor("{ 100: false, perFile: true }"),
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
        code: configFor(
          "{ branches: 80, functions: 100, lines: 100, statements: 100, perFile: true }",
        ),
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
      {
        name: "a CommonJS cjs config is directed to the inspectable ESM form",
        code: `module.exports = { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };`,
        filename: "vite.config.cjs",
        errors: [{ messageId: "commonJsTestConfig" }],
      },
      {
        name: "a CommonJS js config cannot bypass the ESM resolver",
        code: `module["exports"] = { test: { coverage: { thresholds: ${FULL_THRESHOLDS} } } };`,
        filename: "vitest.config.js",
        errors: [{ messageId: "commonJsTestConfig" }],
      },
    ],
  });
});
