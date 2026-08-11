import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireSpecLintCoverage } from "./require-spec-lint-coverage--lint-every-spec-file.ts";

const SOURCE_FILE = "packages/cart/src/basket.ts";

const SPEC_FILE = "packages/cart/src/basket.test.ts";

const CONFIG_FILE = "vite.config.ts";

const BUNDLE_RULE = "dont-review-it/require-test-block-spelling--use-configured-fn";

const SPELLED_SUFFIXES = "`.test.ts`, `.test.tsx`";

const DECLARATION = "export const total = 1;";

const configFor = (lint: string): string => `export default { lint: ${lint} };`;

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-require-spec-lint-coverage-"));

const writeFixture = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

writeFixture("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
writeFixture("package.json", '{ "name": "@fixture/root" }\n');
writeFixture("src/legacy/basket.test.ts", 'it("counts", () => {});\n');
const ignoringConfig = writeFixture(CONFIG_FILE, DECLARATION);

describe("dont-review-it/require-spec-lint-coverage--lint-every-spec-file", () => {
  testLintRule(requireSpecLintCoverage, {
    valid: [
      {
        name: "a source file that declares no test block stands outside this bundle",
        code: DECLARATION,
        filename: SOURCE_FILE,
      },
      {
        name: "a source file that binds `it` to a helper of its own declares no test block",
        code: `const it = (title: string, run: () => void): void => { run(); };\nit("counts", () => { console.log(title); });`,
        filename: SOURCE_FILE,
      },
      {
        name: "a source file that names `it` on a member declares no test block",
        code: `const helpers = { it: 1 };\nexport const held = helpers.it;`,
        filename: SOURCE_FILE,
      },
      {
        name: "a spec file that declares a test block sits inside the reach of this bundle",
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that declares its blocks through a renamed import sits inside that reach too",
        code: `import { it as scenario } from "vitest";\nscenario("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that holds no test block yet is a spec somebody started",
        code: DECLARATION,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that takes the test vocabulary from an import keeps its name",
        code: `import { expect } from "vitest";\nexport const held = expect;`,
        filename: SPEC_FILE,
      },
      {
        name: "a bundle rule held at the level that fails a run passes",
        code: configFor(`{ rules: { "${BUNDLE_RULE}": "error" } }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside this bundle may sit at any level",
        code: configFor(
          `{ rules: { "dont-review-it/no-array-mutation--derive-new-array": "off" } }`,
        ),
        filename: CONFIG_FILE,
      },
      {
        name: "a setting only one rule reads stays with that rule",
        code: configFor(
          `{ rules: { "dont-review-it/forbid-oversized-file--split-by-responsibility": ["error", { maxLines: 400 }] } }`,
        ),
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is read for its declarations alone",
        code: configFor(`{ rules: { "${BUNDLE_RULE}": "off" } }`),
        filename: "rules-snapshot.ts",
      },
      {
        name: "a rules entry whose key is computed names no rule this repository holds",
        code: `const held = "x";\n${configFor(`{ rules: { [held]: "off" } }`)}`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rules block assembled by spread carries no entry to read",
        code: `const shared = {};\n${configFor(`{ rules: { ...shared } }`)}`,
        filename: CONFIG_FILE,
      },
      {
        name: "a severity written as a single-element array carries no options",
        code: configFor(`{ rules: { "${BUNDLE_RULE}": ["error"] } }`),
        filename: CONFIG_FILE,
      },
      {
        name: "options assembled by spread carry no setting to read",
        code: `const shared = {};\n${configFor(`{ rules: { "${BUNDLE_RULE}": ["error", { ...shared }] } }`)}`,
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration that holds no lint block holds nothing to read",
        code: `export default { test: { coverage: {} } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a declaration that binds names by destructuring binds no test vocabulary",
        code: `const { held } = { held: 1 };\nexport const value = held;`,
        filename: SPEC_FILE,
      },
      {
        name: "a source file that declares a function of its own keeps its name",
        code: `function held(): number { return 1; }\nexport const value = held();`,
        filename: SOURCE_FILE,
      },
    ],
    invalid: [
      {
        name: "a source file that declares a test block sits outside the reach of this bundle",
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "it", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "the other injected spelling of a test block is read the same way",
        code: `test("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "test", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a modifier in front of the block does not take the declaration out of reach",
        code: `it.each([1, 2])("counts %s", (held: number) => { expect(held).toBe(held); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "it", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that binds `expect` to something else is swept into this bundle",
        code: `const expect = (held: number): number => held;\nexport const doubled = expect(2);`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "expect", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that declares a function named `test` is swept into this bundle",
        code: `function test(held: number): number { return held; }\nexport const doubled = test(2);`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "test", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that declares a class named `expect` is swept into this bundle",
        code: `class expect { held = 1; }\nexport const held = expect;`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "expect", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a bundle rule taken down to a level that passes a run is reported",
        code: configFor(`{ rules: { "${BUNDLE_RULE}": "off" } }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "disabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "an override that takes a bundle rule down over part of the tree is reported",
        code: `const carried = "apps/**";\n${configFor(
          `{ overrides: [{ files: [carried, "apps/site/**"], rules: { "${BUNDLE_RULE}": "warn" } }] }`,
        )}`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "scopedDisabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "warn", scope: "`apps/site/**`" },
          },
        ],
      },
      {
        name: "an override whose paths are written outside the entry names no scope",
        code: `const paths = ["apps/site/**"];\n${configFor(
          `{ overrides: [{ files: paths, rules: { "${BUNDLE_RULE}": "off" } }] }`,
        )}`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "disabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "a setting more than one rule reads must not sit in a single rule entry",
        code: configFor(
          `{ rules: { "${BUNDLE_RULE}": ["error", { specFileSuffixes: [".spec.ts"] }] } }`,
        ),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "settingWrittenPerRule",
            data: { settingKey: "specFileSuffixes", ruleName: BUNDLE_RULE },
          },
        ],
      },
      {
        name: "an ignore entry that covers an authored spec file is reported",
        code: configFor(`{ ignorePatterns: ["**/legacy/**", "docs/**"] }`),
        filename: ignoringConfig,
        errors: [
          {
            messageId: "ignoredSpecFile",
            data: { pattern: "**/legacy/**", matchedPath: "src/legacy/basket.test.ts" },
          },
        ],
      },
    ],
  });
});
