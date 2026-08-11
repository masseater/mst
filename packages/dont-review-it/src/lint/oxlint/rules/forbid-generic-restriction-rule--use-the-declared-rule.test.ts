import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidGenericRestrictionRule } from "./forbid-generic-restriction-rule--use-the-declared-rule.ts";

const MODULE_IMPORT_RULE = "forbid-declared-module-import--use-declared-replacement";

const EXPORT_REFERENCE_RULE = "forbid-declared-export-reference--use-declared-replacement";

const OWNER_IMPORT_RULE = "forbid-module-import-outside-owner--import-through-owner";

const CONFIG_FILE = "vite.config.ts";

const PRESET_FILE = "src/configs/upstream-rules.ts";

const configFor = (rules: string): string => `export default { lint: { rules: ${rules} } };`;

describe("dont-review-it/forbid-generic-restriction-rule--use-the-declared-rule", () => {
  testLintRule(forbidGenericRestrictionRule, {
    valid: [
      {
        name: "a rule outside the table may sit at any level",
        code: configFor(`{ "no-console": "error", "no-shadow-restricted-names": "error" }`),
        filename: CONFIG_FILE,
      },
      {
        name: "this package's own rules carry their bans in their own options",
        code: configFor(
          `{ "dont-review-it/${MODULE_IMPORT_RULE}": ["error", { restricted: [{ module: "lodash" }] }] }`,
        ),
        filename: CONFIG_FILE,
      },
      {
        name: "a listed rule written as disabled is left alone",
        code: configFor(
          `{ "no-restricted-imports": "off", "no-restricted-syntax": "allow", "no-restricted-globals": 0 }`,
        ),
        filename: CONFIG_FILE,
      },
      {
        name: "a listed rule disabled through a named constant is left alone",
        code: configFor(`{ "no-restricted-imports": LINT_SEVERITY.OFF }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a listed rule disabled in the head of a list is left alone",
        code: configFor(`{ "no-restricted-imports": ["off", { paths: ["lodash"] }] }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a value outside the severity vocabulary marks an object that holds no rule entry",
        code: `export const OWNERS = { "no-restricted-imports": "the import boundary" };`,
      },
      {
        name: "a computed key names no rule",
        code: configFor(`{ [chosen]: "error" }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a block assembled by spreading another block carries no key of its own",
        code: configFor(`{ ...carried, "no-console": "error" }`),
        filename: CONFIG_FILE,
      },
      {
        name: "a binding taken out of an object is not a rule entry",
        code: `const { "no-restricted-imports": held } = carried;`,
      },
      {
        name: "a registered exception carrying grounds is the path this rule leaves open",
        code: configFor(`{ "no-restricted-syntax": "error" }`),
        filename: CONFIG_FILE,
        options: [
          {
            exceptions: [
              {
                rule: "no-restricted-syntax",
                reason: "the shape has no rule of its own in this package yet",
              },
            ],
          },
        ],
      },
    ],
    invalid: [
      {
        name: "a listed rule enabled in the lint configuration names where its bans belong",
        code: configFor(`{ "no-restricted-imports": ["error", { paths: ["lodash"] }] }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "no-restricted-imports", substitute: MODULE_IMPORT_RULE },
          },
        ],
      },
      {
        name: "a plugin-prefixed spelling names the same rule",
        code: configFor(`{ "typescript/no-restricted-imports": "error" }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "typescript/no-restricted-imports", substitute: MODULE_IMPORT_RULE },
          },
        ],
      },
      {
        name: "a rule left at a level that only warns still holds the ban",
        code: configFor(`{ "no-restricted-globals": "warn" }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "no-restricted-globals", substitute: EXPORT_REFERENCE_RULE },
          },
        ],
      },
      {
        name: "a severity written as a number that runs the rule is reported",
        code: configFor(`{ "no-restricted-properties": 2 }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "no-restricted-properties", substitute: EXPORT_REFERENCE_RULE },
          },
        ],
      },
      {
        name: "a severity held in a binding outside this file is not a disabled spelling",
        code: configFor(`{ "no-restricted-paths": chosenSeverity }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "no-restricted-paths", substitute: OWNER_IMPORT_RULE },
          },
        ],
      },
      {
        name: "a listed rule this package has no receiver for asks for a rule of its own",
        code: configFor(`{ "no-restricted-syntax": "error", "no-restricted-exports": "error" }`),
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "undelegatedRestrictionRule",
            data: { ruleName: "no-restricted-syntax", substitute: "" },
          },
          {
            messageId: "undelegatedRestrictionRule",
            data: { ruleName: "no-restricted-exports", substitute: "" },
          },
        ],
      },
      {
        name: "an entry inside an override is read the same way",
        code: `export default { lint: { overrides: [{ files: ["apps/**"], rules: { "no-restricted-types": "error" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "undelegatedRestrictionRule" }],
      },
      {
        name: "a rule table split out of the lint configuration is read the same way",
        code: `export const UPSTREAM_RULES = { "no-restricted-imports": LINT_SEVERITY.ERROR };`,
        filename: PRESET_FILE,
        errors: [{ messageId: "redirectedRestrictionRule" }],
      },
      {
        name: "an exception without grounds leaves the entry standing",
        code: configFor(`{ "no-restricted-syntax": "error" }`),
        filename: CONFIG_FILE,
        options: [{ exceptions: [{ rule: "no-restricted-syntax", reason: "   " }] }],
        errors: [
          {
            messageId: "groundlessRestrictionException",
            data: { ruleName: "no-restricted-syntax", substitute: "" },
          },
        ],
      },
      {
        name: "an exception named with a plugin prefix covers the same rule",
        code: configFor(`{ "eslint/no-restricted-imports": "error" }`),
        filename: CONFIG_FILE,
        options: [{ exceptions: [{ rule: "no-restricted-imports" }] }],
        errors: [{ messageId: "groundlessRestrictionException" }],
      },
      {
        name: "a rule added by the configuration joins the ones this rule already carries",
        code: configFor(
          `{ "no-restricted-html-elements": "error", "no-restricted-imports": "error" }`,
        ),
        filename: CONFIG_FILE,
        options: [
          {
            restrictionRules: [
              {
                rule: "no-restricted-html-elements",
                substitute: "forbid-declared-element--use-the-owned-component",
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "redirectedRestrictionRule",
            data: {
              ruleName: "no-restricted-html-elements",
              substitute: "forbid-declared-element--use-the-owned-component",
            },
          },
          {
            messageId: "redirectedRestrictionRule",
            data: { ruleName: "no-restricted-imports", substitute: MODULE_IMPORT_RULE },
          },
        ],
      },
      {
        name: "a rule added without a receiver asks for a rule of its own",
        code: configFor(`{ "no-restricted-html-elements": "error" }`),
        filename: CONFIG_FILE,
        options: [{ restrictionRules: [{ rule: "no-restricted-html-elements" }] }],
        errors: [{ messageId: "undelegatedRestrictionRule" }],
      },
    ],
  });
});
