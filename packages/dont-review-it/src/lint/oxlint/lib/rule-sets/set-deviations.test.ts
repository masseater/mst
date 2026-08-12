import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { configuredRuleBlockOf, ruleBlockObjectOf } from "./configured-rule-blocks.ts";
import { setDeviationsIn } from "./set-deviations.ts";

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

const it = test
  .extend("deviationsOfABlockNamingNoRuleOfASet", () => {
    const statement = parseSync("config.ts", `const config = { rules: { "no-console": "error" } };`)
      .program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfABlockHoldingEveryRuleAtOneSeverity", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": "error"`)
      .join(", ");
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, rules: { ${held} } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfABlockTurningEveryRuleOff", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": "off"`)
      .join(", ");
    const statement = parseSync("config.ts", `const config = { rules: { ${held} } };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfABlockNamingPartOfASet", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { rules: { "no-reassign--use-spread-or-iife": "error" } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfARuleBelongingToTwoSets", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { rules: { "no-promise-chain--use-async-await": "off" } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfNamesPrefixedWithTheirPlugin", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"dont-review-it/${rule}": "error"`)
      .join(", ");
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, rules: { ${held} } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfAnOverrideHoldingPartOfASet", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { files: ["apps/site/src/**"], rules: { "no-array-mutation--derive-new-array": "off" } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfAnOverrideWhosePathsThisReaderCannotRead", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { files: chosenPaths, rules: { "no-array-mutation--derive-new-array": "off" } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfASetHeldAtTwoSeverities", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": "error"`)
      .join(", ");
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, rules: { ${held}, "no-array-mutation--derive-new-array": "warn" } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfASeverityThisReaderCannotResolve", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": "error"`)
      .join(", ");
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, rules: { ${held}, "no-reassign--use-spread-or-iife": chosenSeverity } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfASetWhoseEverySeverityIsUnreadable", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": chosenSeverity`)
      .join(", ");
    const statement = parseSync("config.ts", `const config = { rules: { ${held} } };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  })
  .extend("deviationsOfARunDeclaringNoTypeAwareness", () => {
    const held = [...SINGLE_ASSIGNMENT_RULES, ...FAILURE_ROUTING_RULES]
      .map((rule) => `"${rule}": "error"`)
      .join(", ");
    const statement = parseSync("config.ts", `const config = { rules: { ${held} } };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return setDeviationsIn(configuredRuleBlockOf({ object, rules, ancestors: [] }));
  });

describe("set-deviations", () => {
  it("a block naming no rule of a set holds nothing to reconcile", ({
    deviationsOfABlockNamingNoRuleOfASet,
  }) => {
    expect(deviationsOfABlockNamingNoRuleOfASet).toStrictEqual([]);
  });

  it("a block holding every rule of every set at one severity passes", ({
    deviationsOfABlockHoldingEveryRuleAtOneSeverity,
  }) => {
    expect(deviationsOfABlockHoldingEveryRuleAtOneSeverity).toStrictEqual([]);
  });

  it("a block turning every rule of every set off passes", ({
    deviationsOfABlockTurningEveryRuleOff,
  }) => {
    expect(deviationsOfABlockTurningEveryRuleOff).toStrictEqual([]);
  });

  it("a block naming part of a set reports the rules it leaves out", ({
    deviationsOfABlockNamingPartOfASet,
  }) => {
    expect(deviationsOfABlockNamingPartOfASet).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-reassign--use-spread-or-iife",
            raw: '"no-reassign--use-spread-or-iife"',
            start: 26,
            end: 59,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 61, end: 68 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 26,
          end: 68,
        },
        messageId: "partialRuleSet",
        data: {
          ruleSet: "single-assignment",
          namedRule: "no-reassign--use-spread-or-iife",
          missingRules:
            "no-array-mutation--derive-new-array, no-receiver-mutation--derive-new-value, no-class-as-mutable-cell--decide-in-an-iife, no-promise-chain--use-async-await, no-floating-promise--await-the-result, no-blanket-suppression--name-and-record, no-partial-rule-set--enable-the-whole-set",
          holes:
            "a mutating method call on an array passes whole; a mutating method call on a map, a set, a date, or a hand written class passes whole; local mutable state wrapped in a class passes; failure handling spread over chained handlers stays out of every catch clause; a promise nothing waits for drops its failure on the floor; a directive naming no rule silences every rule of this set at once; a configuration holding part of a set passes",
          scope: "",
        },
      },
    ]);
  });

  it("a rule belonging to two sets reports the rules each set leaves out", ({
    deviationsOfARuleBelongingToTwoSets,
  }) => {
    expect(deviationsOfARuleBelongingToTwoSets).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 26,
            end: 61,
          },
          value: { type: "Literal", value: "off", raw: '"off"', start: 63, end: 68 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 26,
          end: 68,
        },
        messageId: "partialRuleSet",
        data: {
          ruleSet: "single-assignment",
          namedRule: "no-promise-chain--use-async-await",
          missingRules:
            "no-reassign--use-spread-or-iife, no-array-mutation--derive-new-array, no-receiver-mutation--derive-new-value, no-class-as-mutable-cell--decide-in-an-iife, no-floating-promise--await-the-result, no-blanket-suppression--name-and-record, no-partial-rule-set--enable-the-whole-set",
          holes:
            "a rebindable declaration and every assignment shaped write pass; a mutating method call on an array passes whole; a mutating method call on a map, a set, a date, or a hand written class passes whole; local mutable state wrapped in a class passes; a promise nothing waits for drops its failure on the floor; a directive naming no rule silences every rule of this set at once; a configuration holding part of a set passes",
          scope: "",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 26,
            end: 61,
          },
          value: { type: "Literal", value: "off", raw: '"off"', start: 63, end: 68 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 26,
          end: 68,
        },
        messageId: "partialRuleSet",
        data: {
          ruleSet: "failure-routing",
          namedRule: "no-promise-chain--use-async-await",
          missingRules:
            "no-empty-catch--throw-or-handle, no-silent-catch--rethrow-or-handle, no-floating-promise--await-the-result",
          holes:
            "a catch clause carrying no statement passes; a catch clause that records the failure nowhere passes; a promise nothing waits for drops its failure on the floor",
          scope: "",
        },
      },
    ]);
  });

  it("the name a configuration prefixes with its plugin names the same rule", ({
    deviationsOfNamesPrefixedWithTheirPlugin,
  }) => {
    expect(deviationsOfNamesPrefixedWithTheirPlugin).toStrictEqual([]);
  });

  it("an override holding part of a set reports the paths it takes them out of", ({
    deviationsOfAnOverrideHoldingPartOfASet,
  }) => {
    expect(deviationsOfAnOverrideHoldingPartOfASet).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-array-mutation--derive-new-array",
            raw: '"no-array-mutation--derive-new-array"',
            start: 55,
            end: 92,
          },
          value: { type: "Literal", value: "off", raw: '"off"', start: 94, end: 99 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 55,
          end: 99,
        },
        messageId: "scopedPartialRuleSet",
        data: {
          ruleSet: "single-assignment",
          namedRule: "no-array-mutation--derive-new-array",
          missingRules:
            "no-reassign--use-spread-or-iife, no-receiver-mutation--derive-new-value, no-class-as-mutable-cell--decide-in-an-iife, no-promise-chain--use-async-await, no-floating-promise--await-the-result, no-blanket-suppression--name-and-record, no-partial-rule-set--enable-the-whole-set",
          holes:
            "a rebindable declaration and every assignment shaped write pass; a mutating method call on a map, a set, a date, or a hand written class passes whole; local mutable state wrapped in a class passes; failure handling spread over chained handlers stays out of every catch clause; a promise nothing waits for drops its failure on the floor; a directive naming no rule silences every rule of this set at once; a configuration holding part of a set passes",
          scope: "apps/site/src/**",
        },
      },
    ]);
  });

  it("an override this reader cannot read the paths of still reports the set it splits", ({
    deviationsOfAnOverrideWhosePathsThisReaderCannotRead,
  }) => {
    expect(deviationsOfAnOverrideWhosePathsThisReaderCannotRead).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-array-mutation--derive-new-array",
            raw: '"no-array-mutation--derive-new-array"',
            start: 46,
            end: 83,
          },
          value: { type: "Literal", value: "off", raw: '"off"', start: 85, end: 90 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 46,
          end: 90,
        },
        messageId: "scopedPartialRuleSet",
        data: {
          ruleSet: "single-assignment",
          namedRule: "no-array-mutation--derive-new-array",
          missingRules:
            "no-reassign--use-spread-or-iife, no-receiver-mutation--derive-new-value, no-class-as-mutable-cell--decide-in-an-iife, no-promise-chain--use-async-await, no-floating-promise--await-the-result, no-blanket-suppression--name-and-record, no-partial-rule-set--enable-the-whole-set",
          holes:
            "a rebindable declaration and every assignment shaped write pass; a mutating method call on a map, a set, a date, or a hand written class passes whole; local mutable state wrapped in a class passes; failure handling spread over chained handlers stays out of every catch clause; a promise nothing waits for drops its failure on the floor; a directive naming no rule silences every rule of this set at once; a configuration holding part of a set passes",
          scope: "the paths it names",
        },
      },
    ]);
  });

  it("a set held at two severities reports the rule sitting at the weaker one", ({
    deviationsOfASetHeldAtTwoSeverities,
  }) => {
    expect(deviationsOfASetHeldAtTwoSeverities).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-array-mutation--derive-new-array",
            raw: '"no-array-mutation--derive-new-array"',
            start: 548,
            end: 585,
          },
          value: { type: "Literal", value: "warn", raw: '"warn"', start: 587, end: 593 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 548,
          end: 593,
        },
        messageId: "unevenRuleSetSeverity",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-array-mutation--derive-new-array",
          severity: "warn",
          matchedRule: "no-reassign--use-spread-or-iife",
          matchedSeverity: "error",
          hole: "a mutating method call on an array passes whole",
        },
      },
    ]);
  });

  it("a severity this reader cannot resolve is reported on the rule carrying it", ({
    deviationsOfASeverityThisReaderCannotResolve,
  }) => {
    expect(deviationsOfASeverityThisReaderCannotResolve).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-reassign--use-spread-or-iife",
            raw: '"no-reassign--use-spread-or-iife"',
            start: 548,
            end: 581,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 583,
            end: 597,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 548,
          end: 597,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-reassign--use-spread-or-iife" },
      },
    ]);
  });

  it("a set whose every severity is unreadable reports each one and holds no unevenness", ({
    deviationsOfASetWhoseEverySeverityIsUnreadable,
  }) => {
    expect(deviationsOfASetWhoseEverySeverityIsUnreadable).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-reassign--use-spread-or-iife",
            raw: '"no-reassign--use-spread-or-iife"',
            start: 26,
            end: 59,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 61,
            end: 75,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 26,
          end: 75,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-reassign--use-spread-or-iife" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-array-mutation--derive-new-array",
            raw: '"no-array-mutation--derive-new-array"',
            start: 77,
            end: 114,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 116,
            end: 130,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 77,
          end: 130,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-array-mutation--derive-new-array" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-receiver-mutation--derive-new-value",
            raw: '"no-receiver-mutation--derive-new-value"',
            start: 132,
            end: 172,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 174,
            end: 188,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 132,
          end: 188,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-receiver-mutation--derive-new-value" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-class-as-mutable-cell--decide-in-an-iife",
            raw: '"no-class-as-mutable-cell--decide-in-an-iife"',
            start: 190,
            end: 235,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 237,
            end: 251,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 190,
          end: 251,
        },
        messageId: "unreadableRuleSetSeverity",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-class-as-mutable-cell--decide-in-an-iife",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 253,
            end: 288,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 290,
            end: 304,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 253,
          end: 304,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-promise-chain--use-async-await" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-floating-promise--await-the-result",
            raw: '"no-floating-promise--await-the-result"',
            start: 306,
            end: 345,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 347,
            end: 361,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 306,
          end: 361,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-floating-promise--await-the-result" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-blanket-suppression--name-and-record",
            raw: '"no-blanket-suppression--name-and-record"',
            start: 363,
            end: 404,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 406,
            end: 420,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 363,
          end: 420,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "single-assignment", ruleName: "no-blanket-suppression--name-and-record" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-partial-rule-set--enable-the-whole-set",
            raw: '"no-partial-rule-set--enable-the-whole-set"',
            start: 422,
            end: 465,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 467,
            end: 481,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 422,
          end: 481,
        },
        messageId: "unreadableRuleSetSeverity",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-partial-rule-set--enable-the-whole-set",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 253,
            end: 288,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 290,
            end: 304,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 253,
          end: 304,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "failure-routing", ruleName: "no-promise-chain--use-async-await" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-floating-promise--await-the-result",
            raw: '"no-floating-promise--await-the-result"',
            start: 306,
            end: 345,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 347,
            end: 361,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 306,
          end: 361,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "failure-routing", ruleName: "no-floating-promise--await-the-result" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-empty-catch--throw-or-handle",
            raw: '"no-empty-catch--throw-or-handle"',
            start: 483,
            end: 516,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 518,
            end: 532,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 483,
          end: 532,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "failure-routing", ruleName: "no-empty-catch--throw-or-handle" },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-silent-catch--rethrow-or-handle",
            raw: '"no-silent-catch--rethrow-or-handle"',
            start: 534,
            end: 570,
          },
          value: {
            type: "Identifier",
            decorators: [],
            name: "chosenSeverity",
            optional: false,
            typeAnnotation: null,
            start: 572,
            end: 586,
          },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 534,
          end: 586,
        },
        messageId: "unreadableRuleSetSeverity",
        data: { ruleSet: "failure-routing", ruleName: "no-silent-catch--rethrow-or-handle" },
      },
    ]);
  });

  it("a run declaring no type awareness reports every rule of the set that reads types", ({
    deviationsOfARunDeclaringNoTypeAwareness,
  }) => {
    expect(deviationsOfARunDeclaringNoTypeAwareness).toStrictEqual([
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-array-mutation--derive-new-array",
            raw: '"no-array-mutation--derive-new-array"',
            start: 70,
            end: 107,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 109, end: 116 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 70,
          end: 116,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-array-mutation--derive-new-array",
          hole: "a mutating method call on an array passes whole",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-receiver-mutation--derive-new-value",
            raw: '"no-receiver-mutation--derive-new-value"',
            start: 118,
            end: 158,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 160, end: 167 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 118,
          end: 167,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-receiver-mutation--derive-new-value",
          hole: "a mutating method call on a map, a set, a date, or a hand written class passes whole",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-class-as-mutable-cell--decide-in-an-iife",
            raw: '"no-class-as-mutable-cell--decide-in-an-iife"',
            start: 169,
            end: 214,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 216, end: 223 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 169,
          end: 223,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-class-as-mutable-cell--decide-in-an-iife",
          hole: "local mutable state wrapped in a class passes",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 225,
            end: 260,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 262, end: 269 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 225,
          end: 269,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-promise-chain--use-async-await",
          hole: "failure handling spread over chained handlers stays out of every catch clause",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-floating-promise--await-the-result",
            raw: '"no-floating-promise--await-the-result"',
            start: 271,
            end: 310,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 312, end: 319 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 271,
          end: 319,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "single-assignment",
          ruleName: "no-floating-promise--await-the-result",
          hole: "a promise nothing waits for drops its failure on the floor",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-promise-chain--use-async-await",
            raw: '"no-promise-chain--use-async-await"',
            start: 225,
            end: 260,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 262, end: 269 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 225,
          end: 269,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "failure-routing",
          ruleName: "no-promise-chain--use-async-await",
          hole: "failure handling spread over chained handlers stays out of every catch clause",
        },
      },
      {
        property: {
          type: "Property",
          kind: "init",
          key: {
            type: "Literal",
            value: "no-floating-promise--await-the-result",
            raw: '"no-floating-promise--await-the-result"',
            start: 271,
            end: 310,
          },
          value: { type: "Literal", value: "error", raw: '"error"', start: 312, end: 319 },
          method: false,
          shorthand: false,
          computed: false,
          optional: false,
          start: 271,
          end: 319,
        },
        messageId: "typelessRuleSetHost",
        data: {
          ruleSet: "failure-routing",
          ruleName: "no-floating-promise--await-the-result",
          hole: "a promise nothing waits for drops its failure on the floor",
        },
      },
    ]);
  });
});
