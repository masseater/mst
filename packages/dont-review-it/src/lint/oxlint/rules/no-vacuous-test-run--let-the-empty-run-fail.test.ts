import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noVacuousTestRun } from "./no-vacuous-test-run--let-the-empty-run-fail.ts";

const configFor = (testBlock: string): string =>
  `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: ${testBlock} });\n`;

describe("dont-review-it/no-vacuous-test-run--let-the-empty-run-fail", () => {
  testLintRule(noVacuousTestRun, {
    valid: [
      {
        name: "a test config that says nothing about an empty run passes",
        code: configFor("{ coverage: { thresholds: { 100: true, perFile: true } } }"),
        filename: "vite.config.ts",
      },
      {
        name: "an empty run spelled out as a failure passes",
        code: configFor("{ passWithNoTests: false }"),
        filename: "vite.config.ts",
      },
      {
        name: "a later duplicate that spells the failure is the one that counts",
        code: `export default { test: { passWithNoTests: true }, test: { passWithNoTests: false } };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "the same key outside the test block is not the option the run reads",
        code: `export default { passWithNoTests: true, test: {} };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a test block handed over as a value that is not an object literal is left alone",
        code: `import { test } from "./shared.ts";\nexport default { test };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a config with no default export is left alone",
        code: `export const config = { test: { passWithNoTests: true } };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a config assembled behind an identifier is left alone",
        code: `const config = { test: { passWithNoTests: true } };\nexport default config;\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a file that is not a test config is never looked at",
        code: `export default { test: { passWithNoTests: true } };\n`,
        filename: "src/index.ts",
      },
      {
        name: "a name that merely ends in the config name is not a test config",
        code: `export default { test: { passWithNoTests: true } };\n`,
        filename: "src/legacy-vite.config.ts",
      },
      {
        name: "a config for a tool other than the test runner is not a test config",
        code: `export default { test: { passWithNoTests: true } };\n`,
        filename: "knip.config.ts",
      },
    ],
    invalid: [
      {
        name: "a run told to pass when it found no test file is reported",
        code: configFor("{ passWithNoTests: true }"),
        filename: "vite.config.ts",
        errors: [{ messageId: "vacuousTestRun" }],
      },
      {
        name: "a config written as a plain object literal is read the same way",
        code: `export default { test: { passWithNoTests: true } };\n`,
        filename: "vite.config.mts",
        errors: [{ messageId: "vacuousTestRun" }],
      },
      {
        name: "a vitest config outside a vite-plus setup is held to the same demand",
        code: `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { passWithNoTests: true } });\n`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "vacuousTestRun" }],
      },
      {
        name: "the option written with a computed string key is the option it names",
        code: `export default { test: { ["passWithNoTests"]: true } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "vacuousTestRun" }],
      },
      {
        name: "a later duplicate that spells the pass is the one that counts",
        code: `export default { test: { passWithNoTests: false }, test: { passWithNoTests: true } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "vacuousTestRun" }],
      },
      {
        name: "the outcome handed over by a binding is reported",
        code: `import { passWithNoTests } from "./shared.ts";\nexport default { test: { passWithNoTests } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsettledEmptyRunOutcome" }],
      },
      {
        name: "the outcome computed while the run starts is reported",
        code: `export default { test: { passWithNoTests: process.env["CI"] === undefined } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsettledEmptyRunOutcome" }],
      },
      {
        name: "the outcome spelled as a value that is not a boolean is reported",
        code: `export default { test: { passWithNoTests: 1 } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "unsettledEmptyRunOutcome" }],
      },
    ],
  });
});
