import { describe, expect, it } from "vite-plus/test";

import { checkTestRepository as check } from "./check-test-repository.ts";
import { withTestRepository } from "./test-repository.ts";

describe("checkTestRepository no-removal-verification integration", () => {
  it("reports newly added test files that correspond to deleted source files", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/zeta.ts": "export const zeta = true;\n",
          "src/alpha.ts": "export const alpha = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/zeta.test.ts": "",
          "src/alpha.test.ts": "",
        },
        removed: ["src/zeta.ts", "src/alpha.ts"],
      });

      const fileTestReport = await check({ repository, base, head });

      expect(fileTestReport).toStrictEqual({
        exitCode: 1,
        out: 'src/alpha.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/alpha.ts"; remove the test or restore the file.\nsrc/zeta.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/zeta.ts"; remove the test or restore the file.\n',
        error: "",
      });
    });
  });

  it("reports matching file and export absence assertions without correlating another module", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts":
            "export const current = true;\nexport const legacyMode = true;\nexport const retiredMode = true;\n",
          "src/other.ts": "export const legacyMode = true;\n",
          "src/retired.ts": "export const retired = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "specs/repository.spec.ts":
            'import { existsSync } from "node:fs";\nimport * as legacy from "../src/legacy.ts";\nimport * as other from "../src/other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy surface is gone", () => {\n  expect(existsSync("src/retired.ts")).toBe(false);\n  expect(legacy).not.toHaveProperty("legacyMode");\n  expect(legacy.retiredMode).toBeUndefined();\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
          "src/legacy.ts": "export const current = true;\n",
        },
        removed: ["src/retired.ts"],
      });

      const fileAssertionReport = await check({ repository, base, head });

      expect(fileAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'specs/repository.spec.ts:7 no-removal-verification: Do not assert that deleted file "src/retired.ts" remains absent; remove the assertion.\nspecs/repository.spec.ts:8 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\nspecs/repository.spec.ts:9 no-removal-verification: Do not assert that removed export "retiredMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });
});
