import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { disabledRuleDeclarationsIn } from "./disabled-rule-declarations.ts";

const config = defaultPresetAdoptionConfig;

const declarationsIn = (source: string) => disabledRuleDeclarationsIn({ source, config });

describe("disabledRuleDeclarationsIn", () => {
  test("finds a preset rule switched off for the paths an override names", () => {
    const declarations = declarationsIn(
      `export default defineConfig({
  lint: withGitExcludes({
    overrides: [
      {
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: { "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off" },
      },
    ],
  }),
});`,
    );

    expect(declarations).toStrictEqual([
      {
        ruleId: "dont-review-it/no-handmade-standard-io-double--use-standard-io-test",
        line: 6,
        filePatterns: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
      },
    ]);
  });

  test("leaves a rule switched off everywhere without any path to narrow it", () => {
    const declarations = declarationsIn(
      `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
    );

    expect(declarations).toStrictEqual([
      {
        ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
        line: 2,
        filePatterns: [],
      },
    ]);
  });

  test("says nothing about a rule the configuration switches on", () => {
    expect(
      declarationsIn(
        `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "error" } },
});`,
      ),
    ).toStrictEqual([]);
  });

  test("says nothing about a rule that belongs to another plugin", () => {
    expect(
      declarationsIn(
        `export default defineConfig({
  lint: { rules: { "vitest/consistent-test-filename": "off" } },
});`,
      ),
    ).toStrictEqual([]);
  });

  test("says nothing about a rule whose severity is not written as a plain value", () => {
    expect(
      declarationsIn(
        `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": ["off", {}] } },
});`,
      ),
    ).toStrictEqual([]);
  });

  test("says nothing about a rule whose name is computed at run time", () => {
    expect(
      declarationsIn(
        `export default defineConfig({
  lint: { rules: { [ruleId]: "off" } },
});`,
      ),
    ).toStrictEqual([]);
  });

  test("reads the identifier form of a field name", () => {
    expect(
      declarationsIn(
        `export default defineConfig({
  lint: { "rules": { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
      ),
    ).toHaveLength(1);
  });

  test("says nothing about a configuration that exports nothing by default", () => {
    expect(declarationsIn(`export const config = { lint: {} };`)).toStrictEqual([]);
  });

  test("says nothing about a lint block that is not written as a literal", () => {
    expect(declarationsIn(`export default defineConfig({ lint: sharedLint });`)).toStrictEqual([]);
  });

  test("says nothing about an override list that is not written as a literal", () => {
    expect(
      declarationsIn(`export default defineConfig({ lint: { overrides: sharedOverrides } });`),
    ).toStrictEqual([]);
  });

  test("keeps the paths of an override that spells them outside a list as empty", () => {
    const declarations = declarationsIn(
      `export default defineConfig({
  lint: {
    overrides: [
      { files: sharedFiles, rules: { "dont-review-it/no-promise-chain--use-async-await": "off" } },
    ],
  },
});`,
    );

    expect(declarations).toStrictEqual([
      {
        ruleId: "dont-review-it/no-promise-chain--use-async-await",
        line: 4,
        filePatterns: [],
      },
    ]);
  });

  test("drops a path that is not spelled as a plain value", () => {
    const declarations = declarationsIn(
      `export default defineConfig({
  lint: {
    overrides: [
      {
        files: ["packages/web/**", pattern],
        rules: { "dont-review-it/no-promise-chain--use-async-await": "off" },
      },
    ],
  },
});`,
    );

    expect(declarations[0]?.filePatterns).toStrictEqual(["packages/web/**"]);
  });
});
