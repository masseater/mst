import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { objectValueOf } from "../object-literal.ts";
import {
  configuredRuleBlockOf,
  ruleBlockObjectOf,
  type ConfiguredRuleBlock,
} from "./configured-rule-blocks.ts";

import type { ESTree } from "@oxlint/plugins";

const objectIn = (written: string): ESTree.ObjectExpression => {
  const [statement] = parseSync("config.ts", `const config = ${written};`).program.body;
  const declared = statement as ESTree.Statement;
  if (declared.type !== "VariableDeclaration") throw new Error(`no declaration in ${written}`);
  const spelled = declared.declarations[0]?.init;
  if (spelled?.type !== "ObjectExpression") throw new Error(`no object in ${written}`);
  return spelled;
};

const blockIn = (written: string): ConfiguredRuleBlock | null => {
  const object = objectIn(written);
  const rules = ruleBlockObjectOf(object);
  return rules === null ? null : configuredRuleBlockOf({ object, rules, ancestors: [] });
};

const firstOverrideOf = (object: ESTree.ObjectExpression): ESTree.ObjectExpression => {
  const overrides = objectValueOf({ object, key: "overrides" });
  const [element] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
  if (element?.type !== "ObjectExpression") throw new Error("no override object");
  return element;
};

const spelledRulesIn = (written: string): readonly string[] =>
  (blockIn(written)?.rules ?? []).map((rule) => `${rule.ruleName}=${String(rule.level)}`);

describe("configured-rule-blocks", () => {
  test("the rules a block spells come out with the level each one sits at", () => {
    expect(spelledRulesIn(`{ rules: { "a": "error", "b": ["warn", {}], "c": 0 } }`)).toStrictEqual([
      "a=error",
      "b=warn",
      "c=off",
    ]);
  });

  test("a rule whose severity this reader cannot resolve keeps no level", () => {
    expect(spelledRulesIn(`{ rules: { "a": chosenSeverity } }`)).toStrictEqual(["a=null"]);
  });

  test("a key assembled at run time names no rule this reader can hold", () => {
    expect(spelledRulesIn(`{ rules: { [computed]: "error", ...shared } }`)).toStrictEqual([]);
  });

  test("an object carrying no rules object is no block", () => {
    expect(blockIn(`{ test: { coverage: {} } }`)).toBeNull();
    expect(blockIn(`{ rules: elsewhere }`)).toBeNull();
  });

  test("a block naming no files covers the whole run", () => {
    expect(blockIn(`{ rules: {} }`)?.scope).toBeNull();
  });

  test("a block naming files carries the paths it covers", () => {
    expect(
      blockIn(`{ files: ["apps/site/**", "packages/cart/**"], rules: {} }`)?.scope,
    ).toStrictEqual(["apps/site/**", "packages/cart/**"]);
  });

  test("a scope this reader cannot resolve stands as a scope holding no path", () => {
    expect(blockIn(`{ files: chosenPaths, rules: {} }`)?.scope).toStrictEqual([]);
    expect(blockIn(`{ files: [chosenPath, 1], rules: {} }`)?.scope).toStrictEqual([]);
  });

  test("a configuration turning type awareness on declares it for its own block", () => {
    expect(blockIn(`{ options: { typeAware: true }, rules: {} }`)?.declaresTypeAwareness).toBe(
      true,
    );
  });

  test("a configuration leaving type awareness unspelled declares none", () => {
    expect(blockIn(`{ rules: {} }`)?.declaresTypeAwareness).toBe(false);
    expect(blockIn(`{ options: { typeAware: false }, rules: {} }`)?.declaresTypeAwareness).toBe(
      false,
    );
    expect(blockIn(`{ options: chosenOptions, rules: {} }`)?.declaresTypeAwareness).toBe(false);
  });

  test("an override takes the type awareness the configuration around it declares", () => {
    const object = objectIn(
      `{ options: { typeAware: true }, overrides: [{ files: [], rules: {} }] }`,
    );
    const override = firstOverrideOf(object);
    const rules = ruleBlockObjectOf(override);
    if (rules === null) throw new Error("no rules in the override");
    expect(
      configuredRuleBlockOf({ object: override, rules, ancestors: [object] }).declaresTypeAwareness,
    ).toBe(true);
    expect(
      configuredRuleBlockOf({ object: override, rules, ancestors: [] }).declaresTypeAwareness,
    ).toBe(false);
  });
});
