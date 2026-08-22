import { describe, expect, test } from "vite-plus/test";

import { createWorkspaceLintRule } from "./create-workspace-lint-rule.ts";

describe("createWorkspaceLintRule", () => {
  describe("a rule an author defined for a workspace", () => {
    const it = test.extend("transformedRule", () =>
      createWorkspaceLintRule({ workspaceDir: "packages/example" })({
        name: "no-example--do-something-else",
        meta: {
          type: "problem",
          docs: {
            description: "Report every debugger statement.",
            relatedGuidelines: ["docs/guidelines/example.md"],
          },
          messages: {
            first: "A debugger statement must not stay in the source. Delete it.",
            second: "A debugger statement must not reach review. Delete it as well.   ",
          },
          schema: [],
        },
        create(inspection) {
          return {
            DebuggerStatement(node) {
              inspection.report({ node, messageId: "first" });
            },
          };
        },
      }));

    it("keeps the name, the description and the related guidelines the author wrote, points the canonical document pointer at the generated rule document, and appends a repository relative pointer to every message body", ({
      transformedRule,
    }) => {
      expect(transformedRule).toMatchInlineSnapshot(`
        {
          "create": [Function],
          "meta": {
            "docs": {
              "description": "Report every debugger statement.",
              "relatedGuidelines": [
                "docs/guidelines/example.md",
              ],
              "url": "https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-example--do-something-else.md",
            },
            "messages": {
              "first": "A debugger statement must not stay in the source. Delete it. See packages/example/docs/lint/no-example--do-something-else.md.",
              "second": "A debugger statement must not reach review. Delete it as well. See packages/example/docs/lint/no-example--do-something-else.md.",
            },
            "schema": [],
            "type": "problem",
          },
          "name": "no-example--do-something-else",
        }
      `);
    });
  });
});
