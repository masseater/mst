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
  shipped: true,
  messages: [],
};

describe("renderRuleIndex", () => {
  describe("no rules at all", () => {
    const it = test.extend("ruleIndex", () => renderRuleIndex([]));

    it("renders the head of the table and nothing else", ({ ruleIndex }) => {
      expect(ruleIndex).toBe("| Rule | Description | Tool | Notices |\n| --- | --- | --- | --- |");
    });
  });

  describe("a rule whose source path names its tool", () => {
    const it = test.extend("ruleIndex", () => renderRuleIndex([plainRule]));

    it("gives the row a link to the rule document and the name of the tool", ({ ruleIndex }) => {
      expect(ruleIndex).toBe(
        [
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-plain--decorate-it](./no-plain--decorate-it.md) | Disallow plainness | oxlint |  |",
        ].join("\n"),
      );
    });
  });

  describe("a rule that fixes, suggests, takes options and writes a pipe in its description", () => {
    const it = test.extend("ruleIndex", () =>
      renderRuleIndex([
        {
          ...plainRule,
          description: "Disallow `a | b` unions",
          fixable: true,
          hasSuggestions: true,
          configurable: true,
        },
      ]));

    it("marks the three notices, keeps the pipe inside its cell and appends the legend", ({
      ruleIndex,
    }) => {
      expect(ruleIndex).toBe(
        [
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-plain--decorate-it](./no-plain--decorate-it.md) | Disallow `a \\| b` unions | oxlint | 🔧 💡 ⚙️ |",
          "",
          "Notices — 🔧: fixable / 💡: suggestions / ⚙️: options",
        ].join("\n"),
      );
    });
  });

  describe("a source path without a lint segment and one that ends at it", () => {
    const it = test.extend("ruleIndex", () =>
      renderRuleIndex([
        { ...plainRule, sourcePath: "src/rules/no-plain--decorate-it.ts" },
        { ...plainRule, name: "no-tail--move-it", sourcePath: "src/lint" },
      ]));

    it("puts a placeholder in the tool cell of both rows", ({ ruleIndex }) => {
      expect(ruleIndex).toBe(
        [
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-plain--decorate-it](./no-plain--decorate-it.md) | Disallow plainness | - |  |",
          "| [no-tail--move-it](./no-tail--move-it.md) | Disallow plainness | - |  |",
        ].join("\n"),
      );
    });
  });

  describe("a workspace where one rule is left off the shipped preset", () => {
    const it = test.extend("ruleIndex", () =>
      renderRuleIndex([
        { ...plainRule, name: "no-shipped--fix-it" },
        { ...plainRule, name: "no-named--enable-it", shipped: false },
      ]));

    it("puts the two under headings of their own with the note on the named side", ({
      ruleIndex,
    }) => {
      expect(ruleIndex).toBe(
        [
          "## Shipped in the preset",
          "",
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-shipped--fix-it](./no-shipped--fix-it.md) | Disallow plainness | oxlint |  |",
          "",
          "## Enabled by name",
          "",
          "Rules this workspace ships without putting them in the preset. A consumer names one in `rules` to turn it on. Why a rule is left out is written in its own document.",
          "",
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-named--enable-it](./no-named--enable-it.md) | Disallow plainness | oxlint |  |",
        ].join("\n"),
      );
    });
  });

  describe("rules handed over out of order", () => {
    const it = test.extend("ruleIndex", () =>
      renderRuleIndex([
        { ...plainRule, name: "no-zebra--saddle-it" },
        { ...plainRule, name: "no-alpha--promote-it" },
      ]));

    it("puts the rows in the order of the rule names", ({ ruleIndex }) => {
      expect(ruleIndex).toBe(
        [
          "| Rule | Description | Tool | Notices |",
          "| --- | --- | --- | --- |",
          "| [no-alpha--promote-it](./no-alpha--promote-it.md) | Disallow plainness | oxlint |  |",
          "| [no-zebra--saddle-it](./no-zebra--saddle-it.md) | Disallow plainness | oxlint |  |",
        ].join("\n"),
      );
    });
  });
});
