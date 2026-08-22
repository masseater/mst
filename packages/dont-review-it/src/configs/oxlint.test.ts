import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const PROCESS_TIMEOUT_MS = 180_000;

const TEST_TIMEOUT_MS = 300_000;

const LINT_ARGUMENT_TAIL = ["--format", "json", "--threads", "1"] as const;

const SPAWN_SETTINGS: SpawnSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  timeout: PROCESS_TIMEOUT_MS,
};

const PRESET_PATH = fileURLToPath(new URL("./preset.ts", import.meta.url));

const CONFIG_LINT_OPTIONS_SOURCE =
  '{ rules: { "dont-review-it/no-default-export--use-named-export": ["error", { toolRequiredFileNames: ["vite.config.ts"] }] } }';

const ISOLATED_LINT_CONFIG_SOURCE = `import { dontReviewItPreset } from ${JSON.stringify(PRESET_PATH)};\nexport default { lint: dontReviewItPreset.lint(${CONFIG_LINT_OPTIONS_SOURCE}) };\n`;

const FORBIDDEN_PATH_IGNORE_SOURCE = "node_modules/\ndist/\ncoverage/\n.env\n";

const LINT_INTEGRATION_SCENARIOS = [
  {
    title: "a canonical config whose coverage contract is absent",
    fileName: "vite.config.ts",
    source: `import { dontReviewItPreset } from ${JSON.stringify(PRESET_PATH)};\nexport default { lint: dontReviewItPreset.lint(${CONFIG_LINT_OPTIONS_SOURCE}), test: { mockReset: true, restoreMocks: true, coverage: {} } };\n`,
    expectedDiagnosticSummaries: [
      "dont-review-it(no-partial-coverage-source-universe--include-production-files)|error",
      "dont-review-it(no-lenient-coverage-threshold--demand-full-coverage)|error",
    ],
  },
  {
    title: "changed-only coverage in both test and coverage settings",
    fileName: "vite.config.ts",
    source: `import { dontReviewItPreset } from ${JSON.stringify(PRESET_PATH)};\nexport default { lint: dontReviewItPreset.lint(${CONFIG_LINT_OPTIONS_SOURCE}), test: { mockReset: true, restoreMocks: true, changed: "HEAD", coverage: { changed: "HEAD", include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`,
    expectedDiagnosticSummaries: [
      "dont-review-it(no-partial-coverage-source-universe--include-production-files)|error",
      "dont-review-it(no-partial-coverage-source-universe--include-production-files)|error",
    ],
  },
  {
    title: "official and custom replacement authorities",
    fileName: "replacement-authorities.ts",
    source: [
      'const propertyRecord = { key: "value" };',
      'const ownsKey = Object.prototype.hasOwnProperty.call(propertyRecord, "key");',
      'const statusNames = ["alpha", "beta"];',
      'const selectedLabel = "beta";',
      "const matchedLabel = Boolean(/beta/u.exec(selectedLabel));",
      "const toNumber = (numericCandidate: unknown) => Number(numericCandidate);",
      'const parsedNumber = toNumber("1");',
      "const lastLabel = statusNames.slice(-1).pop();",
      'const splitText = (textValue: string): readonly string[] => textValue.split("");',
      "const letters = statusNames.map(splitText).flat(1);",
      "const decodeText = (textValue: string) => decodeURIComponent(textValue);",
      'const decodedLabel = decodeText("beta%20label");',
    ].join("\n"),
    expectedDiagnosticSummaries: [
      "eslint(prefer-object-has-own)|error",
      "unicorn(prefer-regexp-test)|error",
      "unicorn(prefer-array-flat-map)|error",
      "dont-review-it(no-identity-wrapper--call-the-target-directly)|error",
      "dont-review-it(no-array-mutation--derive-new-array)|error",
      "dont-review-it(no-identity-wrapper--call-the-target-directly)|error",
    ],
  },
  {
    title: "named and unnamed catch failures",
    fileName: "catch-authority.ts",
    source: [
      "export const tryNamed = (): boolean => { try { return true; } catch (operationFailure) { return operationFailure instanceof Error; } };",
      "export const tryUnnamed = (): boolean => { try { return true; } catch { return false; } };",
    ].join("\n"),
    expectedDiagnosticSummaries: [
      "dont-review-it(no-discarded-failure--receive-and-surface-it)|error",
    ],
  },
  {
    title: "unsafe replacement candidates",
    fileName: "unselected-replacements.ts",
    source: [
      'const statusNames = ["alpha", "beta"];',
      'const selectedStatus = "beta";',
      "const hasSelectedStatus = statusNames.findIndex((statusName) => statusName === selectedStatus) !== -1;",
      "const unsafeInteger = BigInt(9_007_199_254_740_992);",
    ].join("\n"),
    expectedDiagnosticSummaries: [],
  },
] as const;

describe("published oxlint integration", { timeout: TEST_TIMEOUT_MS }, () => {
  describe.each(LINT_INTEGRATION_SCENARIOS)("$title", (lintIntegrationScenario) => {
    const it = test.extend("diagnosticSummaries", ({}, { onCleanup }) => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-lint-integration-"));
      onCleanup(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      symlinkSync(
        join(process.cwd(), "../../node_modules"),
        join(fixtureRoot, "node_modules"),
        "dir",
      );
      writeFileSync(
        join(fixtureRoot, "package.json"),
        '{ "private": true, "type": "module" }',
        "utf8",
      );
      writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
      if (lintIntegrationScenario.fileName !== "vite.config.ts") {
        writeFileSync(join(fixtureRoot, "vite.config.ts"), ISOLATED_LINT_CONFIG_SOURCE, "utf8");
      }
      const fixturePath = join(fixtureRoot, lintIntegrationScenario.fileName);
      writeFileSync(fixturePath, lintIntegrationScenario.source, "utf8");
      const linted = spawnSync(
        "vp",
        ["lint", lintIntegrationScenario.fileName, ...LINT_ARGUMENT_TAIL],
        { ...SPAWN_SETTINGS, cwd: fixtureRoot },
      );
      const lintOutput = JSON.parse(linted.stdout) as {
        readonly diagnostics: readonly {
          readonly code: string;
          readonly severity: string;
        }[];
      };
      return lintOutput.diagnostics.map(({ code, severity }) => `${code}|${severity}`);
    });

    it("returns the exact diagnostic authorities", ({ diagnosticSummaries }) => {
      expect(diagnosticSummaries).toStrictEqual(
        lintIntegrationScenario.expectedDiagnosticSummaries,
      );
    });
  });

  describe("a canonical config carrying a literal top-level root", () => {
    const fixedSource = `import { dontReviewItPreset } from ${JSON.stringify(PRESET_PATH)};\nexport default { lint: dontReviewItPreset.lint(${CONFIG_LINT_OPTIONS_SOURCE}), test: { mockReset: true, restoreMocks: true, coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`;

    const it = test
      .extend("initialDiagnosticCodes", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-config-root-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "vite.config.ts");
        writeFileSync(
          fixturePath,
          fixedSource.replace("test: {", 'root: "../other", test: {'),
          "utf8",
        );
        const linted = spawnSync("vp", ["lint", "vite.config.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const lintOutput = JSON.parse(linted.stdout) as {
          readonly diagnostics: readonly { readonly code: string }[];
        };
        return lintOutput.diagnostics.map(({ code }) => code);
      })
      .extend("fixedConfigSource", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-config-root-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "vite.config.ts");
        writeFileSync(
          fixturePath,
          fixedSource.replace("test: {", 'root: "../other", test: {'),
          "utf8",
        );
        spawnSync("vp", ["lint", "--fix", "vite.config.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        return readFileSync(fixturePath, "utf8");
      })
      .extend("diagnosticCodesAfterFix", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-config-root-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "vite.config.ts");
        writeFileSync(
          fixturePath,
          fixedSource.replace("test: {", 'root: "../other", test: {'),
          "utf8",
        );
        spawnSync("vp", ["lint", "--fix", "vite.config.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const linted = spawnSync("vp", ["lint", "vite.config.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const lintOutput = JSON.parse(linted.stdout) as {
          readonly diagnostics: readonly { readonly code: string }[];
        };
        return lintOutput.diagnostics.map(({ code }) => code);
      });

    it("reports the canonical root authority", ({ initialDiagnosticCodes }) => {
      expect(initialDiagnosticCodes).toStrictEqual([
        "dont-review-it(no-partial-coverage-source-universe--include-production-files)",
      ]);
    });

    it("removes the literal root", ({ fixedConfigSource }) => {
      expect(fixedConfigSource).toBe(fixedSource);
    });

    it("leaves no diagnostic after the fix", ({ diagnosticCodesAfterFix }) => {
      expect(diagnosticCodesAfterFix).toStrictEqual([]);
    });
  });

  describe("an interface used by one function", () => {
    const interfaceSource =
      "interface Draft { readonly title: string; }\nexport const read = (draft: Draft): string => draft.title;\n";

    const it = test
      .extend("initialDiagnosticCodes", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-type-authority-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        writeFileSync(join(fixtureRoot, "vite.config.ts"), ISOLATED_LINT_CONFIG_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "type-authority.ts");
        writeFileSync(fixturePath, interfaceSource, "utf8");
        const linted = spawnSync("vp", ["lint", "type-authority.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const lintOutput = JSON.parse(linted.stdout) as {
          readonly diagnostics: readonly { readonly code: string }[];
        };
        return lintOutput.diagnostics.map(({ code }) => code);
      })
      .extend("fixedTypeSource", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-type-authority-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        writeFileSync(join(fixtureRoot, "vite.config.ts"), ISOLATED_LINT_CONFIG_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "type-authority.ts");
        writeFileSync(fixturePath, interfaceSource, "utf8");
        spawnSync("vp", ["lint", "--fix", "type-authority.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        return readFileSync(fixturePath, "utf8");
      })
      .extend("diagnosticCodesAfterOfficialFix", ({}, { onCleanup }) => {
        const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-type-authority-"));
        onCleanup(() => {
          rmSync(fixtureRoot, { recursive: true, force: true });
        });
        symlinkSync(
          join(process.cwd(), "../../node_modules"),
          join(fixtureRoot, "node_modules"),
          "dir",
        );
        writeFileSync(
          join(fixtureRoot, "package.json"),
          '{ "private": true, "type": "module" }',
          "utf8",
        );
        writeFileSync(join(fixtureRoot, ".gitignore"), FORBIDDEN_PATH_IGNORE_SOURCE, "utf8");
        writeFileSync(join(fixtureRoot, "vite.config.ts"), ISOLATED_LINT_CONFIG_SOURCE, "utf8");
        const fixturePath = join(fixtureRoot, "type-authority.ts");
        writeFileSync(fixturePath, interfaceSource, "utf8");
        spawnSync("vp", ["lint", "--fix", "type-authority.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const linted = spawnSync("vp", ["lint", "type-authority.ts", ...LINT_ARGUMENT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: fixtureRoot,
        });
        const lintOutput = JSON.parse(linted.stdout) as {
          readonly diagnostics: readonly { readonly code: string }[];
        };
        return lintOutput.diagnostics.map(({ code }) => code);
      });

    it("starts with the official type-definition authority", ({ initialDiagnosticCodes }) => {
      expect(initialDiagnosticCodes).toStrictEqual(["typescript(consistent-type-definitions)"]);
    });

    it("applies the official type-definition fix", ({ fixedTypeSource }) => {
      expect(fixedTypeSource).toBe(
        "type Draft = { readonly title: string; }\nexport const read = (draft: Draft): string => draft.title;\n",
      );
    });

    it("hands the fixed alias to the custom authority", ({ diagnosticCodesAfterOfficialFix }) => {
      expect(diagnosticCodesAfterOfficialFix).toStrictEqual([
        "dont-review-it(no-single-use-local-type--inline-at-the-use-site)",
      ]);
    });
  });
});
