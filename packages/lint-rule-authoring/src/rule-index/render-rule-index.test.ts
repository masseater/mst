import { describe, expect, test } from "vite-plus/test";

import { renderRuleIndex } from "./render-rule-index.ts";

import type { LintRuleFacts } from "./rule-facts.ts";

const plainRule: LintRuleFacts = {
  name: "no-plain--decorate-it",
  description: "Disallow plainness",
  sourcePath: "src/lint/oxlint/rules/no-plain--decorate-it.ts",
  fixable: false,
  hasSuggestions: false,
  configurable: false,
};

describe("renderRuleIndex", () => {
  test("no rules renders the head of the table and nothing else", () => {
    expect(renderRuleIndex([])).toBe(
      "| ルール | 説明 | ツール | 補足 |\n| --- | --- | --- | --- |",
    );
  });

  test("a rule row links its document and names its tool", () => {
    expect(renderRuleIndex([plainRule])).toBe(
      [
        "| ルール | 説明 | ツール | 補足 |",
        "| --- | --- | --- | --- |",
        "| [no-plain--decorate-it](./no-plain--decorate-it.md) | Disallow plainness | oxlint |  |",
      ].join("\n"),
    );
  });

  test("notices come with their legend and pipes in prose stay inside their cell", () => {
    const noticed: LintRuleFacts = {
      ...plainRule,
      description: "Disallow `a | b` unions",
      fixable: true,
      hasSuggestions: true,
      configurable: true,
    };

    const rendered = renderRuleIndex([noticed]);

    expect(rendered).toContain("| Disallow `a \\| b` unions | oxlint | 🔧 💡 ⚙️ |");
    expect(rendered).toContain(
      "補足の記号 — 🔧: 自動修正あり / 💡: エディタの修正候補あり / ⚙️: オプションあり",
    );
  });

  test("a source that names no tool renders a placeholder", () => {
    const rendered = renderRuleIndex([
      { ...plainRule, sourcePath: "src/rules/no-plain--decorate-it.ts" },
      { ...plainRule, name: "no-tail--move-it", sourcePath: "src/lint" },
    ]);

    expect(rendered).toContain("| Disallow plainness | - |");
    expect(rendered.split("\n").at(-1)).toContain("| Disallow plainness | - |");
  });

  test("rows are ordered by rule name", () => {
    const rendered = renderRuleIndex([
      { ...plainRule, name: "no-zebra--saddle-it" },
      { ...plainRule, name: "no-alpha--promote-it" },
    ]);

    const rows = rendered.split("\n").slice(2);
    expect(rows[0]).toContain("no-alpha--promote-it");
    expect(rows[1]).toContain("no-zebra--saddle-it");
  });
});
