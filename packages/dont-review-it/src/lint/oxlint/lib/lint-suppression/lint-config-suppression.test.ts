import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { ignoreEntriesIn, lintBlockOf, weakenedTargetRulesIn } from "./lint-config-suppression.ts";

import type { ESTree } from "@oxlint/plugins";

const TARGET_RULES = ["no-duplicate-exported-type--reuse-authoritative-type"];

const TARGET_KEY = "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type";

const lintIn = (code: string): ESTree.ObjectExpression | null =>
  lintBlockOf({
    body: parseSync("vite.config.ts", code).program.body.map(
      (statement) => statement as ESTree.Statement,
    ),
  });

const configWith = (lint: string): string => `export default { lint: ${lint} };`;

const weakenedIn = (lint: string): readonly string[] => {
  const block = lintIn(configWith(lint));
  if (block === null) throw new Error(`no lint block in ${lint}`);
  return weakenedTargetRulesIn({ lint: block, targetRules: TARGET_RULES }).map(
    (weakened) => `${weakened.ruleName}=${weakened.severity}`,
  );
};

const patternsIn = (lint: string): readonly string[] => {
  const block = lintIn(configWith(lint));
  if (block === null) throw new Error(`no lint block in ${lint}`);
  return ignoreEntriesIn(block).map((listed) => listed.pattern);
};

describe("lint-config-suppression", () => {
  test("the lint block is read through the call that wraps it", () => {
    expect(lintIn(configWith("{ rules: {} }"))?.type).toBe("ObjectExpression");
    expect(lintIn(configWith("dontReviewItPreset.lint({ rules: {} })"))?.type).toBe(
      "ObjectExpression",
    );
    expect(lintIn("export default defineConfig({ lint: { rules: {} } });")?.type).toBe(
      "ObjectExpression",
    );
  });

  test("a config without a readable lint block yields nothing to read", () => {
    expect(lintIn("export const lint = { rules: {} };")).toBeNull();
    expect(lintIn("export default { test: {} };")).toBeNull();
    expect(lintIn(configWith("configuredElsewhere"))).toBeNull();
  });

  test("a target rule held at a level that lets a run pass is weakened", () => {
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "off" } }`)).toStrictEqual([
      `${TARGET_KEY}=off`,
    ]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "warn" } }`)).toStrictEqual([
      `${TARGET_KEY}=warn`,
    ]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "allow" } }`)).toStrictEqual([
      `${TARGET_KEY}=allow`,
    ]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": 1 } }`)).toStrictEqual([`${TARGET_KEY}=1`]);
  });

  test("a target rule held at a level that fails a run is left alone", () => {
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "error" } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "deny" } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": 2 } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": ["error", { max: 1 }] } }`)).toStrictEqual([]);
  });

  test("the severity written first in a list is the one that counts", () => {
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": ["off", { max: 1 }] } }`)).toStrictEqual([
      `${TARGET_KEY}=off`,
    ]);
  });

  test("a severity spelled through a named constant is read by its member name", () => {
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": LINT_SEVERITY.OFF } }`)).toStrictEqual([
      `${TARGET_KEY}=off`,
    ]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": LINT_SEVERITY.ERROR } }`)).toStrictEqual([]);
  });

  test("a severity the config does not spell out is not read as weakened", () => {
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": chosenSeverity } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": [...spread] } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": [] } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { [computed]: "off" } }`)).toStrictEqual([]);
    expect(weakenedIn(`{ rules: { "${TARGET_KEY}": "chosen" } }`)).toStrictEqual([]);
  });

  test("a rules block assembled by spreading another block is read for what it spells", () => {
    expect(weakenedIn(`{ rules: { ...shared, "${TARGET_KEY}": "off" } }`)).toStrictEqual([
      `${TARGET_KEY}=off`,
    ]);
  });

  test("a rule outside the target set is not this rule's business", () => {
    expect(weakenedIn(`{ rules: { "no-console": "off" } }`)).toStrictEqual([]);
  });

  test("the rules an override carries are read the same way", () => {
    expect(
      weakenedIn(`{ overrides: [{ files: ["a/**"], rules: { "${TARGET_KEY}": "off" } }] }`),
    ).toStrictEqual([`${TARGET_KEY}=off`]);
    expect(weakenedIn(`{ overrides: [{ files: ["a/**"] }, "elsewhere", ...more] }`)).toStrictEqual(
      [],
    );
    expect(weakenedIn(`{ overrides: elsewhere }`)).toStrictEqual([]);
  });

  test("a lint block without rules yields nothing", () => {
    expect(weakenedIn("{ }")).toStrictEqual([]);
    expect(weakenedIn("{ rules: elsewhere }")).toStrictEqual([]);
  });

  test("the ignore patterns are the strings the config spells out", () => {
    expect(patternsIn(`{ ignorePatterns: ["dist/**", "src/legacy/**"] }`)).toStrictEqual([
      "dist/**",
      "src/legacy/**",
    ]);
    expect(patternsIn(`{ ignorePatterns: ["dist/**", chosen, 1, ...more] }`)).toStrictEqual([
      "dist/**",
    ]);
    expect(patternsIn("{ ignorePatterns: elsewhere }")).toStrictEqual([]);
    expect(patternsIn("{ }")).toStrictEqual([]);
  });
});
