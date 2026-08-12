import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { objectValueOf } from "../object-literal.ts";
import { configuredRuleBlockOf, ruleBlockObjectOf } from "./configured-rule-blocks.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("blockOfARulesObjectSpellingThreeSeverities", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { rules: { "a": "error", "b": ["warn", {}], "c": 0 } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfARuleWhoseSeverityCannotBeResolved", () => {
    const statement = parseSync("config.ts", `const config = { rules: { "a": chosenSeverity } };`)
      .program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfKeysAssembledWhileTheRunStarts", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { rules: { [computed]: "error", ...shared } };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("rulesObjectOfAConfigurationCarryingCoverageInstead", () => {
    const statement = parseSync("config.ts", `const config = { test: { coverage: {} } };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    return ruleBlockObjectOf(object);
  })
  .extend("rulesObjectOfAConfigurationNamingRulesItKeepsElsewhere", () => {
    const statement = parseSync("config.ts", `const config = { rules: elsewhere };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    return ruleBlockObjectOf(object);
  })
  .extend("blockOfAConfigurationNamingNoFiles", () => {
    const statement = parseSync("config.ts", `const config = { rules: {} };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationNamingTwoPaths", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { files: ["apps/site/**", "packages/cart/**"], rules: {} };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationNamingPathsItKeepsElsewhere", () => {
    const statement = parseSync("config.ts", `const config = { files: chosenPaths, rules: {} };`)
      .program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationListingPathsItCannotSpell", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { files: [chosenPath, 1], rules: {} };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationTurningTypeAwarenessOn", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, rules: {} };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationLeavingTypeAwarenessUnspelled", () => {
    const statement = parseSync("config.ts", `const config = { rules: {} };`).program
      .body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationTurningTypeAwarenessOff", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: false }, rules: {} };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAConfigurationKeepingItsOptionsElsewhere", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { options: chosenOptions, rules: {} };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const rules = ruleBlockObjectOf(object);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object, rules, ancestors: [] });
  })
  .extend("blockOfAnOverrideReadUnderItsConfiguration", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const overrides = objectValueOf({ object, key: "overrides" });
    const [element] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
    if (element?.type !== "ObjectExpression") throw new Error("no override object was written");
    const rules = ruleBlockObjectOf(element);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object: element, rules, ancestors: [object] });
  })
  .extend("blockOfAnOverrideReadOnItsOwn", () => {
    const statement = parseSync(
      "config.ts",
      `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
    ).program.body[0] as ESTree.Statement;
    if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
    const object = statement.declarations[0]?.init;
    if (object?.type !== "ObjectExpression") throw new Error("no object was written");
    const overrides = objectValueOf({ object, key: "overrides" });
    const [element] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
    if (element?.type !== "ObjectExpression") throw new Error("no override object was written");
    const rules = ruleBlockObjectOf(element);
    if (rules === null) throw new Error("no rules object was written");
    return configuredRuleBlockOf({ object: element, rules, ancestors: [] });
  });

describe("configured-rule-blocks", () => {
  it("the rules a block spells come out with the level each one sits at", ({
    blockOfARulesObjectSpellingThreeSeverities,
  }) => {
    expect(blockOfARulesObjectSpellingThreeSeverities).toStrictEqual({
      rules: [
        {
          property: {
            type: "Property",
            kind: "init",
            key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
            value: { type: "Literal", value: "error", raw: '"error"', start: 31, end: 38 },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 26,
            end: 38,
          },
          ruleName: "a",
          level: "error",
        },
        {
          property: {
            type: "Property",
            kind: "init",
            key: { type: "Literal", value: "b", raw: '"b"', start: 40, end: 43 },
            value: {
              type: "ArrayExpression",
              elements: [
                { type: "Literal", value: "warn", raw: '"warn"', start: 46, end: 52 },
                { type: "ObjectExpression", properties: [], start: 54, end: 56 },
              ],
              start: 45,
              end: 57,
            },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 40,
            end: 57,
          },
          ruleName: "b",
          level: "warn",
        },
        {
          property: {
            type: "Property",
            kind: "init",
            key: { type: "Literal", value: "c", raw: '"c"', start: 59, end: 62 },
            value: { type: "Literal", value: 0, raw: "0", start: 64, end: 65 },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 59,
            end: 65,
          },
          ruleName: "c",
          level: "off",
        },
      ],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a rule whose severity this reader cannot resolve keeps no level", ({
    blockOfARuleWhoseSeverityCannotBeResolved,
  }) => {
    expect(blockOfARuleWhoseSeverityCannotBeResolved).toStrictEqual({
      rules: [
        {
          property: {
            type: "Property",
            kind: "init",
            key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
            value: {
              type: "Identifier",
              decorators: [],
              name: "chosenSeverity",
              optional: false,
              typeAnnotation: null,
              start: 31,
              end: 45,
            },
            method: false,
            shorthand: false,
            computed: false,
            optional: false,
            start: 26,
            end: 45,
          },
          ruleName: "a",
          level: null,
        },
      ],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a key assembled at run time names no rule this reader can hold", ({
    blockOfKeysAssembledWhileTheRunStarts,
  }) => {
    expect(blockOfKeysAssembledWhileTheRunStarts).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a configuration carrying coverage instead of rules holds no rules object", ({
    rulesObjectOfAConfigurationCarryingCoverageInstead,
  }) => {
    expect(rulesObjectOfAConfigurationCarryingCoverageInstead).toBe(null);
  });

  it("a configuration naming rules it keeps elsewhere holds no rules object", ({
    rulesObjectOfAConfigurationNamingRulesItKeepsElsewhere,
  }) => {
    expect(rulesObjectOfAConfigurationNamingRulesItKeepsElsewhere).toBe(null);
  });

  it("a block naming no files covers the whole run", ({ blockOfAConfigurationNamingNoFiles }) => {
    expect(blockOfAConfigurationNamingNoFiles).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a block naming files carries the paths it covers", ({
    blockOfAConfigurationNamingTwoPaths,
  }) => {
    expect(blockOfAConfigurationNamingTwoPaths).toStrictEqual({
      rules: [],
      scope: ["apps/site/**", "packages/cart/**"],
      declaresTypeAwareness: false,
    });
  });

  it("a scope named somewhere this reader cannot follow holds no path", ({
    blockOfAConfigurationNamingPathsItKeepsElsewhere,
  }) => {
    expect(blockOfAConfigurationNamingPathsItKeepsElsewhere).toStrictEqual({
      rules: [],
      scope: [],
      declaresTypeAwareness: false,
    });
  });

  it("a scope listing paths this reader cannot spell holds no path", ({
    blockOfAConfigurationListingPathsItCannotSpell,
  }) => {
    expect(blockOfAConfigurationListingPathsItCannotSpell).toStrictEqual({
      rules: [],
      scope: [],
      declaresTypeAwareness: false,
    });
  });

  it("a configuration turning type awareness on declares it for its own block", ({
    blockOfAConfigurationTurningTypeAwarenessOn,
  }) => {
    expect(blockOfAConfigurationTurningTypeAwarenessOn).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: true,
    });
  });

  it("a configuration leaving type awareness unspelled declares none", ({
    blockOfAConfigurationLeavingTypeAwarenessUnspelled,
  }) => {
    expect(blockOfAConfigurationLeavingTypeAwarenessUnspelled).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a configuration turning type awareness off declares none", ({
    blockOfAConfigurationTurningTypeAwarenessOff,
  }) => {
    expect(blockOfAConfigurationTurningTypeAwarenessOff).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("a configuration keeping its options elsewhere declares none", ({
    blockOfAConfigurationKeepingItsOptionsElsewhere,
  }) => {
    expect(blockOfAConfigurationKeepingItsOptionsElsewhere).toStrictEqual({
      rules: [],
      scope: null,
      declaresTypeAwareness: false,
    });
  });

  it("an override takes the type awareness the configuration around it declares", ({
    blockOfAnOverrideReadUnderItsConfiguration,
  }) => {
    expect(blockOfAnOverrideReadUnderItsConfiguration).toStrictEqual({
      rules: [],
      scope: [],
      declaresTypeAwareness: true,
    });
  });

  it("an override read on its own declares no type awareness", ({
    blockOfAnOverrideReadOnItsOwn,
  }) => {
    expect(blockOfAnOverrideReadOnItsOwn).toStrictEqual({
      rules: [],
      scope: [],
      declaresTypeAwareness: false,
    });
  });
});
