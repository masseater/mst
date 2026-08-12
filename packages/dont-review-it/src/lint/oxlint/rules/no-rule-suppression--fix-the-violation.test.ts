import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noRuleSuppression } from "./no-rule-suppression--fix-the-violation.ts";

const SOURCE_FILE = "packages/cart/src/basket.ts";

const SPEC_FILE = "packages/cart/src/basket.test.ts";

const CONFIG_FILE = "vite.config.ts";

const GATE_RULE = "no-redundant-mock-reset--lift-mocks-into-fixture";

const PREFIXED_GATE_RULE = `dont-review-it/${GATE_RULE}`;

const SELF_RULE = "no-rule-suppression--fix-the-violation";

const OUTSIDE_RULE = "no-console";

const DECLARATION = "export const total = 1;";

const configFor = (lint: string): string => `export default { lint: ${lint} };`;

const rulesHolding = (entries: string): string => configFor(`{ rules: { ${entries} } }`);

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-rule-suppression-"));

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

const EVERY_RULE_REACHING_HERE = "every rule reaching this file (this gate among them)";

describe("dont-review-it/no-rule-suppression--fix-the-violation", () => {
  testLintRule(noRuleSuppression, {
    valid: [
      { name: "a spec file carrying no comment passes", code: DECLARATION, filename: SPEC_FILE },
      {
        name: "a comment that opens with no suppression spelling passes",
        code: `// this line holds the running total\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "a suppression naming only a rule outside this gate is another rule's business",
        code: `/* eslint-disable ${OUTSIDE_RULE} */\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "a line suppression naming only a rule outside this gate passes",
        code: `// eslint-disable-next-line ${OUTSIDE_RULE}\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "the exemption comment one gate rule reads is no suppression directive",
        code: `// mock-factory-exemption ${GATE_RULE} -- the runner needs a shim here\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "a type checker directive is no lint suppression",
        code: `// @ts-nocheck the whole file is typed loosely\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "a blanket suppression outside the reach of this gate passes",
        code: `/* eslint-disable */\n${DECLARATION}`,
        filename: SOURCE_FILE,
      },
      {
        name: "a configuration holding a gate rule at error passes",
        code: rulesHolding(`"${PREFIXED_GATE_RULE}": "error"`),
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration holding a gate rule at error with options passes",
        code: rulesHolding(`"${GATE_RULE}": ["error", { specFileSuffixes: [".spec.ts"] }]`),
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration turning a rule outside this gate off passes",
        code: rulesHolding(`"${OUTSIDE_RULE}": "off"`),
        filename: CONFIG_FILE,
      },
      {
        name: "an object carrying rules of another kind is left alone",
        code: `export const grammar = { rules: { sentence: "one" } };`,
        filename: SOURCE_FILE,
      },
      {
        name: "a configuration that keeps suppression comments powerless passes",
        code: configFor(`{ options: { respectEslintDisableDirectives: false } }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a runner configuration holding no lint block has no ignore entry to read",
        code: `export default { pack: { entry: ["src/index.ts"] } };`,
        filename: CONFIG_FILE,
      },
    ],
    invalid: [
      {
        name: "a blanket suppression over a spec file is reported",
        code: `/* eslint-disable */\n${DECLARATION}`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "fileScopedSuppression",
            data: { spelling: "eslint-disable", silenced: EVERY_RULE_REACHING_HERE },
          },
        ],
      },
      {
        name: "a whole file suppression naming a gate rule is reported wherever it stands",
        code: `/* oxlint-disable ${GATE_RULE} */\n${DECLARATION}`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "fileScopedSuppression",
            data: { spelling: "oxlint-disable", silenced: `\`${GATE_RULE}\`` },
          },
        ],
      },
      {
        name: "a next line suppression naming a gate rule is reported",
        code: `// eslint-disable-next-line ${PREFIXED_GATE_RULE}\n${DECLARATION}`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: { spelling: "eslint-disable-next-line", silenced: `\`${GATE_RULE}\`` },
          },
        ],
      },
      {
        name: "a line suppression naming this rule itself is reported",
        code: `${DECLARATION} // oxlint-disable-line ${SELF_RULE}`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: { spelling: "oxlint-disable-line", silenced: `\`${SELF_RULE}\`` },
          },
        ],
      },
      {
        name: "grounds written after the separator leave the report standing",
        code: `// eslint-disable-next-line ${GATE_RULE} -- the shared setup lands later\n${DECLARATION}`,
        filename: SPEC_FILE,
        errors: [{ messageId: "lineScopedSuppression" }],
      },
      {
        name: "a nameless line suppression over a spec file is reported",
        code: `// eslint-disable-next-line\n${DECLARATION}`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: { spelling: "eslint-disable-next-line", silenced: EVERY_RULE_REACHING_HERE },
          },
        ],
      },
      {
        name: "the closing end of a range naming a gate rule is reported",
        code: `${DECLARATION}\n/* eslint-enable ${GATE_RULE} */`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "suppressionRangeEnd",
            data: { spelling: "eslint-enable", silenced: `\`${GATE_RULE}\`` },
          },
        ],
      },
      {
        name: "both ends of a range over a spec file are reported",
        code: `/* oxlint-disable */\n${DECLARATION}\n/* oxlint-enable */`,
        filename: SPEC_FILE,
        errors: [
          { messageId: "fileScopedSuppression" },
          {
            messageId: "suppressionRangeEnd",
            data: { spelling: "oxlint-enable", silenced: EVERY_RULE_REACHING_HERE },
          },
        ],
      },
      {
        name: "a configuration turning a gate rule off is reported",
        code: rulesHolding(`"${PREFIXED_GATE_RULE}": "off"`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedRule",
            data: { ruleName: PREFIXED_GATE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "a configuration lowering a gate rule to a warning is reported",
        code: rulesHolding(`"${GATE_RULE}": "warn"`),
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "warn" } }],
      },
      {
        name: "a numbered severity below failing is read as the level it stands for",
        code: rulesHolding(`"${GATE_RULE}": 0`),
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "an override taking a gate rule down over a path is reported",
        code: configFor(
          `{ overrides: [{ files: ["src/legacy/**"], rules: { "${GATE_RULE}": "off" } }] }`,
        ),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "scopedWeakenedRule",
            data: { ruleName: GATE_RULE, severity: "off", scope: "`src/legacy/**`" },
          },
        ],
      },
      {
        name: "an entry standing beside a spread this rule cannot read is reported",
        code: rulesHolding(`...sharedRules, "${GATE_RULE}": "off"`),
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "a severity assembled elsewhere is reported",
        code: rulesHolding(`"${GATE_RULE}": chosenSeverity`),
        filename: CONFIG_FILE,
        errors: [{ messageId: "unreadableSeverity", data: { ruleName: GATE_RULE } }],
      },
      {
        name: "a shared configuration outside the runner config is read the same way",
        code: `export const shared = { rules: { "${GATE_RULE}": "off" } };`,
        filename: "packages/cart/lint-preset.ts",
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "a configuration that gives suppression comments back their force is reported",
        code: configFor(`{ options: { respectEslintDisableDirectives: true } }`),
        filename: CONFIG_FILE,
        errors: [{ messageId: "respectedDisableDirectives" }],
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
      {
        name: "a rule name handed to the option joins the gate it cannot take rules out of",
        code: `// eslint-disable-next-line no-spec-clock-stub--freeze-in-fixture\n${DECLARATION}`,
        filename: SPEC_FILE,
        options: [{ targetRules: ["no-spec-clock-stub--freeze-in-fixture"] }],
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: {
              spelling: "eslint-disable-next-line",
              silenced: "`no-spec-clock-stub--freeze-in-fixture`",
            },
          },
        ],
      },
      {
        name: "an empty option list leaves every rule of the gate in place",
        code: `// eslint-disable-next-line ${GATE_RULE}\n${DECLARATION}`,
        filename: SPEC_FILE,
        options: [{ targetRules: [] }],
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: { spelling: "eslint-disable-next-line", silenced: `\`${GATE_RULE}\`` },
          },
        ],
      },
      {
        name: "an option naming no rule list leaves every rule of the gate in place",
        code: `// eslint-disable-next-line ${GATE_RULE}\n${DECLARATION}`,
        filename: SPEC_FILE,
        options: [{}],
        errors: [
          {
            messageId: "lineScopedSuppression",
            data: { spelling: "eslint-disable-next-line", silenced: `\`${GATE_RULE}\`` },
          },
        ],
      },
    ],
  });
});
