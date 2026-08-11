import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { configuredRuleBlockOf, ruleBlockObjectOf } from "./configured-rule-blocks.ts";
import { setDeviationsIn, type SetDeviation } from "./set-deviations.ts";

import type { ESTree } from "@oxlint/plugins";

const SINGLE_ASSIGNMENT_RULES = [
  "no-reassign--use-spread-or-iife",
  "no-array-mutation--derive-new-array",
  "no-receiver-mutation--derive-new-value",
  "no-class-as-mutable-cell--decide-in-an-iife",
  "no-promise-chain--use-async-await",
  "no-floating-promise--await-the-result",
  "no-blanket-suppression--name-and-record",
  "no-partial-rule-set--enable-the-whole-set",
];

const FAILURE_ROUTING_RULES = [
  "no-empty-catch--throw-or-handle",
  "no-silent-catch--rethrow-or-handle",
];

const wholeSetHeldAt = (severity: string): string =>
  [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
    .map((rule) => `"${rule}": ${severity}`)
    .join(", ");

const deviationsIn = (written: string): readonly SetDeviation[] => {
  const [statement] = parseSync("config.ts", `const config = ${written};`).program.body;
  const declared = statement as ESTree.Statement;
  if (declared.type !== "VariableDeclaration") throw new Error(`no declaration in ${written}`);
  const spelled = declared.declarations[0]?.init;
  if (spelled?.type !== "ObjectExpression") throw new Error(`no object in ${written}`);
  const rules = ruleBlockObjectOf(spelled);
  if (rules === null) throw new Error(`no rules block in ${written}`);
  return setDeviationsIn(configuredRuleBlockOf({ object: spelled, rules, ancestors: [] }));
};

const spelledDeviationsIn = (written: string): readonly string[] =>
  deviationsIn(written).map(
    (deviation) =>
      `${deviation.messageId}:${deviation.data.ruleName ?? deviation.data.namedRule ?? ""}`,
  );

describe("set-deviations", () => {
  test("a block naming no rule of a set holds nothing to reconcile", () => {
    expect(spelledDeviationsIn(`{ rules: { "no-console": "error" } }`)).toStrictEqual([]);
  });

  test("a block holding every rule of every set at one severity passes", () => {
    expect(
      spelledDeviationsIn(
        `{ options: { typeAware: true }, rules: { ${wholeSetHeldAt(`"error"`)} } }`,
      ),
    ).toStrictEqual([]);
  });

  test("a block turning every rule of every set off passes", () => {
    expect(spelledDeviationsIn(`{ rules: { ${wholeSetHeldAt(`"off"`)} } }`)).toStrictEqual([]);
  });

  test("a block naming part of a set reports the rules it leaves out", () => {
    const [deviation] = deviationsIn(`{ rules: { "no-reassign--use-spread-or-iife": "error" } }`);
    expect(deviation?.messageId).toBe("partialRuleSet");
    expect(deviation?.data.ruleSet).toBe("single-assignment");
    expect(deviation?.data.missingRules).toBe(
      "no-array-mutation--derive-new-array, no-receiver-mutation--derive-new-value, no-class-as-mutable-cell--decide-in-an-iife, no-promise-chain--use-async-await, no-floating-promise--await-the-result, no-blanket-suppression--name-and-record, no-partial-rule-set--enable-the-whole-set",
    );
    expect(deviation?.data.holes).toContain("a mutating method call on an array passes whole");
  });

  test("a rule belonging to two sets reports the rules each set leaves out", () => {
    expect(
      spelledDeviationsIn(`{ rules: { "no-promise-chain--use-async-await": "off" } }`),
    ).toStrictEqual([
      "partialRuleSet:no-promise-chain--use-async-await",
      "partialRuleSet:no-promise-chain--use-async-await",
    ]);
  });

  test("the name a configuration prefixes with its plugin names the same rule", () => {
    expect(
      spelledDeviationsIn(
        `{ options: { typeAware: true }, rules: { ${[...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES].map((rule) => `"dont-review-it/${rule}": "error"`).join(", ")} } }`,
      ),
    ).toStrictEqual([]);
  });

  test("an override holding part of a set reports the paths it takes them out of", () => {
    const [deviation] = deviationsIn(
      `{ files: ["apps/site/src/**"], rules: { "no-array-mutation--derive-new-array": "off" } }`,
    );
    expect(deviation?.messageId).toBe("scopedPartialRuleSet");
    expect(deviation?.data.scope).toBe("apps/site/src/**");
  });

  test("an override this reader cannot read the paths of still reports the set it splits", () => {
    const [deviation] = deviationsIn(
      `{ files: chosenPaths, rules: { "no-array-mutation--derive-new-array": "off" } }`,
    );
    expect(deviation?.messageId).toBe("scopedPartialRuleSet");
    expect(deviation?.data.scope).toBe("the paths it names");
  });

  test("a set held at two severities reports the rule sitting at the weaker one", () => {
    const [deviation] = deviationsIn(
      `{ options: { typeAware: true }, rules: { ${wholeSetHeldAt(`"error"`)}, "no-array-mutation--derive-new-array": "warn" } }`,
    );
    expect(deviation?.messageId).toBe("unevenRuleSetSeverity");
    expect(deviation?.data.ruleName).toBe("no-array-mutation--derive-new-array");
    expect(deviation?.data.severity).toBe("warn");
    expect(deviation?.data.matchedSeverity).toBe("error");
    expect(deviation?.data.matchedRule).toBe("no-reassign--use-spread-or-iife");
  });

  test("a severity this reader cannot resolve is reported on the rule carrying it", () => {
    const [deviation] = deviationsIn(
      `{ options: { typeAware: true }, rules: { ${wholeSetHeldAt(`"error"`)}, "no-reassign--use-spread-or-iife": chosenSeverity } }`,
    );
    expect(deviation?.messageId).toBe("unreadableRuleSetSeverity");
    expect(deviation?.data.ruleName).toBe("no-reassign--use-spread-or-iife");
  });

  test("a set whose every severity is unreadable reports each one and holds no unevenness", () => {
    expect(spelledDeviationsIn(`{ rules: { ${wholeSetHeldAt("chosenSeverity")} } }`)).toStrictEqual(
      [
        ...SINGLE_ASSIGNMENT_RULES.map((rule) => `unreadableRuleSetSeverity:${rule}`),
        "unreadableRuleSetSeverity:no-promise-chain--use-async-await",
        "unreadableRuleSetSeverity:no-floating-promise--await-the-result",
        ...FAILURE_ROUTING_RULES.map((rule) => `unreadableRuleSetSeverity:${rule}`),
      ],
    );
  });

  test("a run declaring no type awareness reports every rule of the set that reads types", () => {
    expect(spelledDeviationsIn(`{ rules: { ${wholeSetHeldAt(`"error"`)} } }`)).toStrictEqual([
      "typelessRuleSetHost:no-array-mutation--derive-new-array",
      "typelessRuleSetHost:no-receiver-mutation--derive-new-value",
      "typelessRuleSetHost:no-class-as-mutable-cell--decide-in-an-iife",
      "typelessRuleSetHost:no-promise-chain--use-async-await",
      "typelessRuleSetHost:no-floating-promise--await-the-result",
      "typelessRuleSetHost:no-promise-chain--use-async-await",
      "typelessRuleSetHost:no-floating-promise--await-the-result",
    ]);
  });
});
