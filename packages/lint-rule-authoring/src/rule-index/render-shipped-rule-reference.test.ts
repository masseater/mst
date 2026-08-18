import { describe, expect, test } from "vite-plus/test";

import { renderShippedRuleReference } from "./render-shipped-rule-reference.ts";

import type { BundledLintRule } from "./rule-bundle.ts";

const WORKSPACE_DIR = "packages/dont-review-it";

const DOCS_BASE = `https://github.com/masseater/mst/blob/main/${WORKSPACE_DIR}/docs/lint`;

const plainRule: BundledLintRule = {
  bundle: null,
  name: "no-plain--decorate-it",
  relatedGuidelines: [],
  unreadableGuidelines: 0,
  description: "Disallow plainness",
  sourcePath: "src/lint/oxlint/rules/no-plain--decorate-it.ts",
  fixable: false,
  hasSuggestions: false,
  configurable: false,
  shipped: true,
  messages: [],
};

describe("renderShippedRuleReference", () => {
  describe("no rules at all", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({ rules: [], workspaceDir: WORKSPACE_DIR }));

    it("renders the head of the table and nothing else", ({ reference }) => {
      expect(reference).toBe("| Rule | What it rejects | Notices |\n| --- | --- | --- |");
    });
  });

  describe("a rule the preset enables", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({ rules: [plainRule], workspaceDir: WORKSPACE_DIR }));

    it("links the row at the rule document on the repository host", ({ reference }) => {
      expect(reference).toBe(
        [
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-plain--decorate-it](${DOCS_BASE}/no-plain--decorate-it.md) | Disallow plainness |  |`,
        ].join("\n"),
      );
    });
  });

  describe("a rule that fixes, suggests, takes options and writes a pipe in its description", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({
        rules: [
          {
            ...plainRule,
            description: "Disallow `a | b` unions",
            fixable: true,
            hasSuggestions: true,
            configurable: true,
          },
        ],
        workspaceDir: WORKSPACE_DIR,
      }));

    it("marks the three notices, keeps the pipe inside its cell and appends the legend", ({
      reference,
    }) => {
      expect(reference).toBe(
        [
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-plain--decorate-it](${DOCS_BASE}/no-plain--decorate-it.md) | Disallow \`a \\| b\` unions | 🔧 💡 ⚙️ |`,
          "",
          "Notices — 🔧: fixes itself / 💡: offers an editor suggestion / ⚙️: reads options",
        ].join("\n"),
      );
    });
  });

  describe("a workspace whose shipped rules sit in bundles", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({
        rules: [
          { ...plainRule, name: "no-spec--fix-it", bundle: "test" },
          { ...plainRule, name: "no-core--fix-it", bundle: "core" },
          { ...plainRule, name: "no-stray--fix-it" },
        ],
        workspaceDir: WORKSPACE_DIR,
      }));

    it("gives each bundle a heading and keeps the unbundled one under the shipped heading", ({
      reference,
    }) => {
      expect(reference).toBe(
        [
          "## Bundles the preset can carry",
          "",
          "Each bundle is adopted on its own, and a rule sits in exactly one of them. Name the ones this repository takes on where it calls the preset.",
          "",
          "### core",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-core--fix-it](${DOCS_BASE}/no-core--fix-it.md) | Disallow plainness |  |`,
          "",
          "### test",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-spec--fix-it](${DOCS_BASE}/no-spec--fix-it.md) | Disallow plainness |  |`,
          "",
          "## Rules the shipped preset enables",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-stray--fix-it](${DOCS_BASE}/no-stray--fix-it.md) | Disallow plainness |  |`,
        ].join("\n"),
      );
    });
  });

  describe("a workspace whose shipped rules all sit in bundles, with one left off the preset", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({
        rules: [
          { ...plainRule, name: "no-core--fix-it", bundle: "core" },
          { ...plainRule, name: "no-named--enable-it", shipped: false },
        ],
        workspaceDir: WORKSPACE_DIR,
      }));

    it("goes straight from the bundles to the named side", ({ reference }) => {
      expect(reference).toBe(
        [
          "## Bundles the preset can carry",
          "",
          "Each bundle is adopted on its own, and a rule sits in exactly one of them. Name the ones this repository takes on where it calls the preset.",
          "",
          "### core",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-core--fix-it](${DOCS_BASE}/no-core--fix-it.md) | Disallow plainness |  |`,
          "",
          "## Rules this package ships without enabling them",
          "",
          "Whether these hold depends on the adopting repository, so the preset leaves them off. Name one in `rules` to turn it on; its document says why it is not enabled by default.",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-named--enable-it](${DOCS_BASE}/no-named--enable-it.md) | Disallow plainness |  |`,
        ].join("\n"),
      );
    });
  });

  describe("a workspace where one rule is left off the shipped preset", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({
        rules: [
          { ...plainRule, name: "no-shipped--fix-it" },
          { ...plainRule, name: "no-named--enable-it", shipped: false },
        ],
        workspaceDir: WORKSPACE_DIR,
      }));

    it("puts the two under headings of their own with the note on the named side", ({
      reference,
    }) => {
      expect(reference).toBe(
        [
          "## Rules the shipped preset enables",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-shipped--fix-it](${DOCS_BASE}/no-shipped--fix-it.md) | Disallow plainness |  |`,
          "",
          "## Rules this package ships without enabling them",
          "",
          "Whether these hold depends on the adopting repository, so the preset leaves them off. Name one in `rules` to turn it on; its document says why it is not enabled by default.",
          "",
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-named--enable-it](${DOCS_BASE}/no-named--enable-it.md) | Disallow plainness |  |`,
        ].join("\n"),
      );
    });
  });

  describe("rules handed over out of order", () => {
    const it = test.extend("reference", () =>
      renderShippedRuleReference({
        rules: [
          { ...plainRule, name: "no-zebra--saddle-it" },
          { ...plainRule, name: "no-alpha--promote-it" },
        ],
        workspaceDir: WORKSPACE_DIR,
      }));

    it("puts the rows in the order of the rule names", ({ reference }) => {
      expect(reference).toBe(
        [
          "| Rule | What it rejects | Notices |",
          "| --- | --- | --- |",
          `| [no-alpha--promote-it](${DOCS_BASE}/no-alpha--promote-it.md) | Disallow plainness |  |`,
          `| [no-zebra--saddle-it](${DOCS_BASE}/no-zebra--saddle-it.md) | Disallow plainness |  |`,
        ].join("\n"),
      );
    });
  });
});
