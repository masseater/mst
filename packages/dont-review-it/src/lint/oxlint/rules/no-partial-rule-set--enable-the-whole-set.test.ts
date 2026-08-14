import { testLintRule } from "@mst/lint-rule-authoring";
import { range } from "es-toolkit";
import { describe } from "vite-plus/test";

import { noPartialRuleSet } from "./no-partial-rule-set--enable-the-whole-set.ts";

const WHOLE_SET = [
  "no-reassign--use-spread-or-iife",
  "no-array-mutation--derive-new-array",
  "no-receiver-mutation--derive-new-value",
  "no-class-as-mutable-cell--decide-in-an-iife",
  "no-promise-chain--use-async-await",
  "no-floating-promise--await-the-result",
  "no-blanket-suppression--name-and-record",
  "no-partial-rule-set--enable-the-whole-set",
  "no-empty-catch--throw-or-handle",
  "no-silent-catch--rethrow-or-handle",
];

const ARRAY_MUTATION_RULE = "no-array-mutation--derive-new-array";

const REASSIGN_RULE = "no-reassign--use-spread-or-iife";

const WHOLE_SET_AT_ERROR = WHOLE_SET.map((rule) => `"${rule}": "error"`).join(", ");

const WHOLE_SET_AT_OFF = WHOLE_SET.map((rule) => `"${rule}": "off"`).join(", ");

const PREFIXED_WHOLE_SET_AT_ERROR = WHOLE_SET.map(
  (rule) => `"dont-review-it/${rule}": "error"`,
).join(", ");

const WHOLE_SET_WITH_ARRAY_MUTATION_AT_WARN = WHOLE_SET.map(
  (rule) => `"${rule}": ${rule === ARRAY_MUTATION_RULE ? `"warn"` : `"error"`}`,
).join(", ");

const WHOLE_SET_WITH_REASSIGN_AT_AN_OUTSIDE_BINDING = WHOLE_SET.map(
  (rule) => `"${rule}": ${rule === REASSIGN_RULE ? "chosenSeverity" : `"error"`}`,
).join(", ");

const TYPE_READING_RULE_COUNT = 7;

const TYPELESS_HOST_ERRORS = range(TYPE_READING_RULE_COUNT).map(() => ({
  messageId: "typelessRuleSetHost",
}));

describe("dont-review-it/no-partial-rule-set--enable-the-whole-set", () => {
  testLintRule(noPartialRuleSet, {
    valid: [
      { name: "source holding no lint configuration passes", code: "export const total = 1;" },
      {
        name: "a configuration holding every rule of every set at one severity passes",
        documented: true,
        code: `export default { lint: { options: { typeAware: true }, rules: { ${WHOLE_SET_AT_ERROR} } } };`,
      },
      {
        name: "the plugin prefix a configuration writes names the same rules",
        code: `export default { lint: { options: { typeAware: true }, rules: { ${PREFIXED_WHOLE_SET_AT_ERROR} } } };`,
      },
      {
        name: "a configuration turning every rule of every set off passes",
        documented: true,
        code: `export default { lint: { rules: { ${WHOLE_SET_AT_OFF} } } };`,
      },
      {
        name: "an override giving every rule of the set the same scope passes",
        code: `export default { lint: { options: { typeAware: true }, rules: { ${WHOLE_SET_AT_ERROR} }, overrides: [{ files: ["apps/site/src/**"], rules: { ${WHOLE_SET_AT_OFF} } }] } };`,
      },
      {
        name: "a rules block naming only rules outside every set is another rule's business",
        code: `export default { lint: { rules: { "no-console": "error", "max-params": ["error", { max: 2 }] } } };`,
      },
      {
        name: "an object carrying rules of another kind is left alone",
        code: `export const grammar = { rules: { sentence: "one" } };`,
      },
      {
        name: "a rules block this rule cannot read holds nothing to reconcile",
        code: `export default { lint: { rules: sharedRules } };`,
      },
      {
        name: "a rule name a configuration assembles at run time names no rule of a set",
        code: `export default { lint: { rules: { [chosenRule]: "off" } } };`,
      },
    ],
    invalid: [
      {
        name: "a configuration naming one rule of a set is reported with the rules it leaves out",
        documented: true,
        code: `export default { lint: { rules: { "${REASSIGN_RULE}": "error" } } };`,
        errors: [{ messageId: "partialRuleSet" }],
      },
      {
        name: "a rule belonging to two sets is reported once for each set it splits",
        code: `export default { lint: { rules: { "no-promise-chain--use-async-await": "off" } } };`,
        errors: [{ messageId: "partialRuleSet" }, { messageId: "partialRuleSet" }],
      },
      {
        name: "an override taking part of a set out of scope is reported with the paths it covers",
        code: `export default { lint: { options: { typeAware: true }, rules: { ${WHOLE_SET_AT_ERROR} }, overrides: [{ files: ["apps/site/src/**"], rules: { "${ARRAY_MUTATION_RULE}": "off", "${REASSIGN_RULE}": "off" } }] } };`,
        errors: [{ messageId: "scopedPartialRuleSet" }],
      },
      {
        name: "a set held at two severities is reported on the rule sitting at the weaker one",
        documented: true,
        code: `export default { lint: { options: { typeAware: true }, rules: { ${WHOLE_SET_WITH_ARRAY_MUTATION_AT_WARN} } } };`,
        errors: [{ messageId: "unevenRuleSetSeverity" }],
      },
      {
        name: "a severity kept outside the configuration is reported on the rule carrying it",
        code: `export default { lint: { options: { typeAware: true }, rules: { ${WHOLE_SET_WITH_REASSIGN_AT_AN_OUTSIDE_BINDING} } } };`,
        errors: [
          {
            messageId: "unreadableRuleSetSeverity",
            data: { ruleSet: "single-assignment", ruleName: REASSIGN_RULE },
          },
        ],
      },
      {
        name: "a set enabled on a run declaring no type awareness is reported for every rule reading types",
        code: `export default { lint: { rules: { ${WHOLE_SET_AT_ERROR} } } };`,
        errors: TYPELESS_HOST_ERRORS,
      },
    ],
  });
});
