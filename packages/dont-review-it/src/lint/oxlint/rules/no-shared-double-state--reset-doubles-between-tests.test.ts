import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSharedDoubleState } from "./no-shared-double-state--reset-doubles-between-tests.ts";

const RESET_AND_RESTORED = "{ mockReset: true, restoreMocks: true }";

describe("dont-review-it/no-shared-double-state--reset-doubles-between-tests", () => {
  testLintRule(noSharedDoubleState, {
    valid: [
      {
        name: "a test block that takes the doubles down before each test passes",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: ${RESET_AND_RESTORED} });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "the settings declared beside the rest of the test options pass",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { mockReset: true, restoreMocks: true, coverage: { thresholds: { 100: true, perFile: true } } } });\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a vitest config outside a vite-plus setup is held to the same demand",
        code: `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: ${RESET_AND_RESTORED} });\n`,
        filename: "vitest.config.ts",
      },
      {
        name: "a config written as a plain object literal is read the same way",
        code: `export default { test: ${RESET_AND_RESTORED} };\n`,
        filename: "vite.config.mts",
      },
      {
        name: "a setting written with a computed string key is the setting it names",
        code: `export default { test: { ["mockReset"]: true, restoreMocks: true } };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a later duplicate of the test block is the one that counts",
        code: `export default { test: { mockReset: false }, test: ${RESET_AND_RESTORED} };\n`,
        filename: "vite.config.ts",
      },
      {
        name: "a file that is not a test config is never looked at",
        code: "export default { test: {} };\n",
        filename: "src/index.ts",
      },
      {
        name: "a name that merely ends in the config name is not a test config",
        code: "export default { test: {} };\n",
        filename: "src/legacy-vite.config.ts",
      },
    ],
    invalid: [
      {
        name: "a config that declares no test block is reported once",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ lint: {} });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingTestBlock" }],
      },
      {
        name: "a config with no default export cannot be read and is reported",
        code: `export const config = { test: ${RESET_AND_RESTORED} };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingTestBlock" }],
      },
      {
        name: "a test block handed over as a value that is not an object literal is reported",
        code: `import { test } from "./shared.ts";\nexport default { test };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "missingTestBlock" }],
      },
      {
        name: "a test block that declares neither setting is reported once for each",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: {} } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "sharedDoubleState" }, { messageId: "sharedDoubleState" }],
      },
      {
        name: "a setting left out is reported on its own",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { mockReset: true } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "sharedDoubleState" }],
      },
      {
        name: "a setting declared false is reported where it stands",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { mockReset: false, restoreMocks: true } });\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "sharedDoubleState" }],
      },
      {
        name: "a setting that is not a plain boolean counts as absent",
        code: `import { mockReset } from "./shared.ts";\nexport default { test: { mockReset, restoreMocks: true } };\n`,
        filename: "vite.config.ts",
        errors: [{ messageId: "sharedDoubleState" }],
      },
    ],
  });
});
