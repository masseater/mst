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

const setWith = (chosen: Readonly<Record<string, string>>): string =>
  WHOLE_SET.map((rule) => `"${rule}": ${chosen[rule] ?? `"error"`}`).join(", ");

const wholeSetAt = (severity: string): string =>
  WHOLE_SET.map((rule) => `"${rule}": "${severity}"`).join(", ");

const prefixedSet = (): string =>
  WHOLE_SET.map((rule) => `"dont-review-it/${rule}": "error"`).join(", ");

const configFor = (lint: string): string => `export default { lint: ${lint} };`;

const typeAwareConfigFor = (rules: string): string =>
  configFor(`{ options: { typeAware: true }, rules: { ${rules} } }`);

const TYPE_READING_RULE_COUNT = 7;

const typelessHostErrors = (): { readonly messageId: string }[] =>
  range(TYPE_READING_RULE_COUNT).map(() => ({ messageId: "typelessRuleSetHost" }));

describe("dont-review-it/no-partial-rule-set--enable-the-whole-set", () => {
  testLintRule(noPartialRuleSet, {
    valid: [
      { name: "source holding no lint configuration passes", code: "export const total = 1;" },
      {
        name: "a configuration holding every rule of every set at one severity passes",
        code: typeAwareConfigFor(setWith({})),
      },
      {
        name: "the plugin prefix a configuration writes names the same rules",
        code: typeAwareConfigFor(prefixedSet()),
      },
      {
        name: "a configuration turning every rule of every set off passes",
        code: configFor(`{ rules: { ${wholeSetAt("off")} } }`),
      },
      {
        name: "an override giving every rule of the set the same scope passes",
        code: configFor(
          `{ options: { typeAware: true }, rules: { ${wholeSetAt("error")} }, overrides: [{ files: ["apps/site/src/**"], rules: { ${wholeSetAt("off")} } }] }`,
        ),
      },
      {
        name: "a rules block naming only rules outside every set is another rule's business",
        code: configFor(
          `{ rules: { "no-console": "error", "max-params": ["error", { max: 2 }] } }`,
        ),
      },
      {
        name: "an object carrying rules of another kind is left alone",
        code: `export const grammar = { rules: { sentence: "one" } };`,
      },
      {
        name: "a rules block this rule cannot read holds nothing to reconcile",
        code: configFor(`{ rules: sharedRules }`),
      },
      {
        name: "a rule name a configuration assembles at run time names no rule of a set",
        code: configFor(`{ rules: { [chosenRule]: "off" } }`),
      },
    ],
    invalid: [
      {
        name: "a configuration naming one rule of a set is reported with the rules it leaves out",
        code: configFor(`{ rules: { "${REASSIGN_RULE}": "error" } }`),
        errors: [{ messageId: "partialRuleSet" }],
      },
      {
        name: "a rule belonging to two sets is reported once for each set it splits",
        code: configFor(`{ rules: { "no-promise-chain--use-async-await": "off" } }`),
        errors: [{ messageId: "partialRuleSet" }, { messageId: "partialRuleSet" }],
      },
      {
        name: "an override taking part of a set out of scope is reported with the paths it covers",
        code: configFor(
          `{ options: { typeAware: true }, rules: { ${setWith({})} }, overrides: [{ files: ["apps/site/src/**"], rules: { "${ARRAY_MUTATION_RULE}": "off", "${REASSIGN_RULE}": "off" } }] }`,
        ),
        errors: [{ messageId: "scopedPartialRuleSet" }],
      },
      {
        name: "a set held at two severities is reported on the rule sitting at the weaker one",
        code: typeAwareConfigFor(setWith({ [ARRAY_MUTATION_RULE]: `"warn"` })),
        errors: [{ messageId: "unevenRuleSetSeverity" }],
      },
      {
        name: "a severity kept outside the configuration is reported on the rule carrying it",
        code: typeAwareConfigFor(setWith({ [REASSIGN_RULE]: "chosenSeverity" })),
        errors: [
          {
            messageId: "unreadableRuleSetSeverity",
            data: { ruleSet: "single-assignment", ruleName: REASSIGN_RULE },
          },
        ],
      },
      {
        name: "a set enabled on a run declaring no type awareness is reported for every rule reading types",
        code: configFor(`{ rules: { ${setWith({})} } }`),
        errors: typelessHostErrors(),
      },
    ],
  });
});
