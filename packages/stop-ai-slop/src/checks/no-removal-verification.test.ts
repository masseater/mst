import { describe, expect, it } from "vite-plus/test";

import { checkTestRepository as check } from "../check-test-repository.ts";
import { withTestRepository } from "../test-repository.ts";

describe("no-removal-verification", () => {
  it("reports a newly added test file that corresponds to a deleted source file", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/legacy.test.ts":
            'import { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(true).toBe(true);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      const fileTestReport = await check({ repository, base, head });

      expect(fileTestReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/legacy.ts"; remove the test or restore the file.\n',
        error: "",
      });
    });
  });

  it("reports a newly added assertion that a deleted file does not exist", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      const fileAssertionReport = await check({ repository, base, head });

      expect(fileAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:5 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("resolves aliased imports in a file absence assertion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync as pathExists } from "node:fs";\nimport { expect as verify, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  verify(pathExists("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      const aliasReport = await check({ repository, base, head });

      expect(aliasReport.exitCode).toBe(1);
      expect(aliasReport.out).toContain('deleted file "src/legacy.ts"');
    });
  });

  it("reports a newly added assertion that a removed named export is absent", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
        },
      });

      const exportAssertionReport = await check({ repository, base, head });

      expect(exportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("reports a newly added assertion for a removed named re-export", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/public.ts": 'export { current, legacyMode } from "./implementation.ts";\n',
          "src/implementation.ts":
            "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/public.ts": 'export { current } from "./implementation.ts";\n',
          "src/public-api.test.ts":
            'import * as publicApi from "./public.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(publicApi).not.toHaveProperty("legacyMode");\n});\n',
        },
      });

      const reExportReport = await check({ repository, base, head });

      expect(reExportReport).toStrictEqual({
        exitCode: 1,
        out: 'src/public-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/public.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("reports a newly added undefined assertion for a removed named export", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy.legacyMode).toBeUndefined();\n});\n',
        },
      });

      const exportAssertionReport = await check({ repository, base, head });

      expect(exportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("reports an additional assertion when the same locator already existed", async () => {
    await withTestRepository(async (repository) => {
      const imports =
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n';
      const existingGuard =
        'test.skip("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
          "src/legacy-api.test.ts": `${imports}\n${existingGuard}`,
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts": `${imports}\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n\n${existingGuard}`,
        },
      });

      const exportAssertionReport = await check({ repository, base, head });

      expect(exportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("reports an assertion whose import changes to the removed export module", async () => {
    await withTestRepository(async (repository) => {
      const assertion =
        'import * as legacy from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
          "src/other.ts": "export const current = true;\n",
          "src/legacy-api.test.ts": assertion,
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts": assertion.replace("./other.ts", "./legacy.ts"),
        },
      });

      const importChangeReport = await check({ repository, base, head });

      expect(importChangeReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("does not report deletion without a new absence check", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not report an absence check without a matching deletion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not report a positive existence assertion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy exists", () => {\n  expect(existsSync("src/legacy.ts")).toBe(true);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not report an existing absence assertion", async () => {
    await withTestRepository(async (repository) => {
      const existingTest =
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
          "src/legacy-api.test.ts": existingTest,
        },
      });
      const head = repository.commit({
        files: { "src/legacy.ts": "export const current = true;\n" },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not correlate the same export name from another module", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/removed-from.ts": "export const current = true;\nexport const legacyMode = true;\n",
          "src/other.ts": "export const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/removed-from.ts": "export const current = true;\n",
          "src/other-api.test.ts":
            'import * as other from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not treat default or type exports as removed value exports", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts":
            "export const current = true;\nexport type Legacy = string;\nexport default true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("non-value exports", () => {\n  expect(legacy).not.toHaveProperty("Legacy");\n  expect(legacy).not.toHaveProperty("default");\n});\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not treat default aliases or default re-exports as removed named exports", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/alias.ts": 'const value = true;\nexport { value as "default" };\n',
          "src/re-export.ts": 'export { value as default } from "./implementation.ts";\n',
          "src/implementation.ts": "export const value = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/alias.ts": "export const current = true;\n",
          "src/re-export.ts": "export const current = true;\n",
          "src/default-api.test.ts":
            'import * as alias from "./alias.ts";\nimport * as reExport from "./re-export.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("default exports", () => {\n  expect(alias).not.toHaveProperty("default");\n  expect(reExport).not.toHaveProperty("default");\n});\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not report a renamed file as deleted", async () => {
    await withTestRepository(async (repository) => {
      const source = "export const legacy = true;\n";
      const base = repository.commit({ files: { "src/legacy.ts": source } });
      const head = repository.commit({
        files: {
          "src/current.ts": source,
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy path is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not report a computed property assertion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy["legacyMode"]).toBeUndefined();\n});\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });
});
