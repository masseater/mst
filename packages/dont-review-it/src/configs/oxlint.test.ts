import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import plugin from "../plugin.ts";
import { runAsyncProcess, type AsyncProcessResult } from "../vitest/async-process.ts";
import { oxlint } from "./oxlint.ts";
import { UPSTREAM_PLUGINS } from "./upstream-rules.ts";

const SUBPROCESS_TIMEOUT_MS = 180_000;
const TEST_TIMEOUT_MS = 300_000;
const TEST_DEADLINE_MARGIN_MS = 5_000;

const runLintBeforeDeadline = async (
  arguments_: readonly string[],
  deadline: number,
): Promise<AsyncProcessResult> =>
  runAsyncProcess({
    label: `vp ${arguments_.join(" ")}`,
    command: "vp",
    arguments_,
    cwd: process.cwd(),
    timeoutMs: Math.min(SUBPROCESS_TIMEOUT_MS, deadline - performance.now()),
  });

describe("oxlint config", () => {
  const rules = oxlint.rules ?? {};

  test("it loads the upstream and dont-review-it plugins through their supported routes", () => {
    expect(oxlint.plugins).toStrictEqual([...UPSTREAM_PLUGINS]);
    expect(oxlint.jsPlugins).toStrictEqual([
      { name: "dont-review-it", specifier: "@mst/dont-review-it/plugin" },
    ]);
    expect(
      Object.keys(rules)
        .filter((ruleName) => ruleName.startsWith("dont-review-it/"))
        .every((ruleName) => Object.hasOwn(plugin.rules, ruleName.replace("dont-review-it/", ""))),
    ).toBe(true);
  });

  test("it configures source and test files with separate complexity contracts", () => {
    const [sourceOverride, testOverride] = oxlint.overrides ?? [];

    expect(sourceOverride).toStrictEqual({
      files: ["**/*.ts", "**/*.tsx"],
      excludeFiles: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      rules: {
        "max-lines-per-function": [
          LINT_SEVERITY.ERROR,
          { max: 200, skipBlankLines: true, skipComments: true },
        ],
      },
    });
    expect(testOverride?.files).toStrictEqual([
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ]);
    expect(testOverride?.rules?.["max-nested-callbacks"]).toBe(LINT_SEVERITY.OFF);
    expect(testOverride?.rules?.["max-statements"]).toBe(LINT_SEVERITY.OFF);
    expect(testOverride?.rules?.["vitest/no-hooks"]).toBe(LINT_SEVERITY.ERROR);
  });

  test("it keeps option-bearing custom rules at error severity with their project limits", () => {
    expect(rules["dont-review-it/forbid-oversized-file--split-by-responsibility"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      { maxLines: 400 },
    ]);
    expect(rules["dont-review-it/no-standalone-tsconfig--extend-shared-preset"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      ["dont-review-it/tsconfig/library.json", "dont-review-it/tsconfig/app.json"],
    ]);
    expect(
      rules["dont-review-it/require-re-export-only-files--move-declaration-to-owning-module"],
    ).toStrictEqual([LINT_SEVERITY.ERROR, { targets: ["**/index.ts", "**/index.tsx"] }]);
  });

  test("it rejects unused suppressions and does not honor eslint disable directives", () => {
    expect(oxlint.categories).toStrictEqual({ correctness: LINT_SEVERITY.ERROR });
    expect(oxlint.options).toStrictEqual({
      reportUnusedDisableDirectives: LINT_SEVERITY.ERROR,
      respectEslintDisableDirectives: false,
    });
  });

  test(
    "the published config applies both coverage guards to one canonical config",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-coverage-config-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "vite.config.ts");
      writeFileSync(fixture, `export default { test: { coverage: {} } };\n`, "utf8");

      const lintRun = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const diagnostics = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };

      expect(lintRun.status).toBe(1);
      expect(diagnostics.diagnostics.map(({ code }) => code)).toStrictEqual([
        "dont-review-it(no-partial-coverage-source-universe--include-production-files)",
        "dont-review-it(no-lenient-coverage-threshold--demand-full-coverage)",
      ]);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the published config rejects changed-only coverage through the canonical test config",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-changed-coverage-config-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "vite.config.ts");
      writeFileSync(
        fixture,
        `export default { test: { changed: "HEAD", coverage: { changed: "HEAD", include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`,
        "utf8",
      );

      const lintRun = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const diagnostics = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
      };

      expect(lintRun.status).toBe(1);
      expect(diagnostics.diagnostics).toHaveLength(2);
      expect(
        diagnostics.diagnostics.every(
          ({ code, message }) =>
            code ===
              "dont-review-it(no-partial-coverage-source-universe--include-production-files)" &&
            message.includes("must not reduce the coverage source universe"),
        ),
      ).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the published config removes a literal top-level root from a canonical test config",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-test-config-root-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "vite.config.ts");
      const fixedSource = `export default { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`;
      writeFileSync(fixture, fixedSource.replace("{ test:", `{ root: "../other", test:`), "utf8");

      const initial = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const initialOutput = JSON.parse(initial.stdout) as {
        readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
      };

      expect(initial.status).toBe(1);
      expect(initialOutput.diagnostics).toHaveLength(1);
      expect(initialOutput.diagnostics[0]?.code).toBe(
        "dont-review-it(no-partial-coverage-source-universe--include-production-files)",
      );
      expect(initialOutput.diagnostics[0]?.message).toContain(
        "must not move config and source discovery",
      );

      const fixed = await runLintBeforeDeadline(
        ["lint", "--fix", fixture, "--format", "json"],
        deadline,
      );
      const fixedOutput = JSON.parse(fixed.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };

      expect(fixed.status).toBe(0);
      expect(fixedOutput.diagnostics).toStrictEqual([]);
      expect(readFileSync(fixture, "utf8")).toBe(fixedSource);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the published config gives each adopted replacement one diagnostic authority",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-replacement-authorities-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "replacement-authorities.ts");
      writeFileSync(
        fixture,
        [
          `const propertyRecord = { key: "value" };`,
          `const ownsKey = Object.prototype.hasOwnProperty.call(propertyRecord, "key");`,
          `const labels = ["alpha", "beta"];`,
          `const selectedLabel = "beta";`,
          `const matchedLabel = Boolean(/beta/u.exec(selectedLabel));`,
          `const toNumber = (candidate: unknown) => Number(candidate);`,
          `const parsedNumber = toNumber("1");`,
          `const lastLabel = labels.slice(-1).pop();`,
          `const splitLabel = (label: string): readonly string[] => label.split("");`,
          `const letters = labels.map(splitLabel).flat(1);`,
          `const decodeLabel = (label: string) => decodeURIComponent(label);`,
          `const decodedLabel = decodeLabel("beta%20label");`,
        ].join("\n"),
        "utf8",
      );

      const lintRun = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const lintOutput = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly {
          readonly code: string;
          readonly labels: readonly [{ readonly span: { readonly line: number } }];
          readonly severity: string;
        }[];
      };

      expect(lintRun.status).toBe(1);
      expect(
        lintOutput.diagnostics.map(({ code, labels: [{ span }], severity }) => ({
          code,
          line: span.line,
          severity,
        })),
      ).toStrictEqual([
        { code: "eslint(prefer-object-has-own)", line: 2, severity: "error" },
        { code: "unicorn(prefer-regexp-test)", line: 5, severity: "error" },
        { code: "unicorn(prefer-array-flat-map)", line: 10, severity: "error" },
        {
          code: "dont-review-it(no-identity-wrapper--use-the-target-directly)",
          line: 6,
          severity: "error",
        },
        {
          code: "dont-review-it(no-array-mutation--derive-new-array)",
          line: 8,
          severity: "error",
        },
        {
          code: "dont-review-it(no-identity-wrapper--use-the-target-directly)",
          line: 11,
          severity: "error",
        },
      ]);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the published config gives catch failures only to the custom authority",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catch-authority-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "catch-authority.ts");
      writeFileSync(
        fixture,
        [
          `export const tryNamed = (): boolean => { try { return true; } catch (operationFailure) { return false; } };`,
          `export const tryUnnamed = (): boolean => { try { return true; } catch { return false; } };`,
        ].join("\n"),
        "utf8",
      );

      const lintRun = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const lintOutput = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly {
          readonly code: string;
          readonly labels: readonly [{ readonly span: { readonly line: number } }];
          readonly severity: string;
        }[];
      };

      expect(lintRun.status).toBe(1);
      expect(
        lintOutput.diagnostics.map(({ code, labels: [{ span }], severity }) => ({
          code,
          line: span.line,
          severity,
        })),
      ).toStrictEqual([
        {
          code: "dont-review-it(no-discarded-failure--receive-and-surface-it)",
          line: 2,
          severity: "error",
        },
      ]);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the official type definition fix hands a single-use interface to the custom authority",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-type-authority-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "type-authority.ts");
      writeFileSync(
        fixture,
        `interface Draft { readonly title: string; }\nexport const read = (draft: Draft): string => draft.title;\n`,
        "utf8",
      );

      const initial = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const initialOutput = JSON.parse(initial.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };
      expect(initial.status).toBe(1);
      expect(initialOutput.diagnostics.map(({ code }) => code)).toStrictEqual([
        "typescript(consistent-type-definitions)",
      ]);

      const fixed = await runLintBeforeDeadline(
        ["lint", "--fix", fixture, "--format", "json"],
        deadline,
      );
      const fixedOutput = JSON.parse(fixed.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };
      expect(fixed.status).toBe(0);
      expect(readFileSync(fixture, "utf8")).toContain(`type Draft = { readonly title: string; }`);
      expect(fixedOutput.diagnostics).toStrictEqual([]);

      const afterFix = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const afterFixOutput = JSON.parse(afterFix.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };
      expect(afterFix.status).toBe(1);
      expect(afterFixOutput.diagnostics.map(({ code }) => code)).toStrictEqual([
        "dont-review-it(no-single-use-local-type--inline-at-the-use-site)",
      ]);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    "the published config leaves unsafe replacement candidates unselected",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-unselected-replacements-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "unselected-replacements.ts");
      writeFileSync(
        fixture,
        [
          `const labels = ["alpha", "beta"];`,
          `const selectedLabel = "beta";`,
          `const hasSelectedLabel = labels.findIndex((label) => label === selectedLabel) !== -1;`,
          `const unsafeInteger = BigInt(9_007_199_254_740_992);`,
        ].join("\n"),
        "utf8",
      );

      const lintRun = await runLintBeforeDeadline(["lint", fixture, "--format", "json"], deadline);
      const lintOutput = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };

      expect(lintRun.status).toBe(0);
      expect(lintOutput.diagnostics).toStrictEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});
