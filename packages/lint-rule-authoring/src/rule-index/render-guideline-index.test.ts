import { describe, expect, test } from "vite-plus/test";

import { renderGuidelineIndex, type GroundedLintRule } from "./render-guideline-index.ts";

const standingOnTests: GroundedLintRule = {
  workspaceDir: "packages/example",
  rule: {
    bundle: null,
    name: "no-thing--allow-it",
    relatedGuidelines: ["docs/guidelines/tests.md"],
    unreadableGuidelines: 0,
    description: "Disallow the thing",
    sourcePath: "src/lint/oxlint/rules/no-thing--allow-it.ts",
    fixable: false,
    hasSuggestions: false,
    configurable: false,
    shipped: true,
    messages: [],
  },
};

const standingOnBoth: GroundedLintRule = {
  workspaceDir: "packages/example",
  rule: {
    bundle: null,
    name: "always-something--drop-it",
    relatedGuidelines: ["docs/guidelines/tests.md", "AGENTS.md"],
    unreadableGuidelines: 0,
    description: "Disallow something | anything",
    sourcePath: "src/lint/oxlint/rules/always-something--drop-it.ts",
    fixable: false,
    hasSuggestions: false,
    configurable: false,
    shipped: true,
    messages: [],
  },
};

describe("renderGuidelineIndex", () => {
  describe("a norm no rule stands on", () => {
    const it = test.extend("rendered", () =>
      renderGuidelineIndex({
        normativeDocuments: ["docs/guidelines/review-findings.md"],
        grounded: [],
      }));

    it("gives it a section saying so", ({ rendered }) => {
      expect(rendered).toMatchInlineSnapshot(`
        "## [docs/guidelines/review-findings.md](../docs/guidelines/review-findings.md)

        No rule of this repository declares this document as its grounds. What the off-the-shelf rules and the other checks cover is not collected here."
      `);
    });
  });

  describe("two rules, one of them standing on two norms", () => {
    const it = test.extend("rendered", () =>
      renderGuidelineIndex({
        normativeDocuments: ["docs/guidelines/tests.md"],
        grounded: [standingOnTests, standingOnBoth],
      }));

    it("gives each norm a section, sorts the rules by name, and escapes the pipes", ({
      rendered,
    }) => {
      expect(rendered).toMatchInlineSnapshot(`
        "## [AGENTS.md](../AGENTS.md)

        | Rule | Description |
        | --- | --- |
        | [always-something--drop-it](../packages/example/docs/lint/always-something--drop-it.md) | Disallow something \\| anything |

        ## [docs/guidelines/tests.md](../docs/guidelines/tests.md)

        | Rule | Description |
        | --- | --- |
        | [always-something--drop-it](../packages/example/docs/lint/always-something--drop-it.md) | Disallow something \\| anything |
        | [no-thing--allow-it](../packages/example/docs/lint/no-thing--allow-it.md) | Disallow the thing |"
      `);
    });
  });
});
