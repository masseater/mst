import { describe, expect, test } from "vite-plus/test";

import {
  createWorkspaceLintRule,
  type WorkspaceLintRuleDocs,
} from "./create-workspace-lint-rule.ts";

describe("create-workspace-lint-rule", () => {
  const createRule = createWorkspaceLintRule({ workspaceDir: "packages/example" });

  const rule = createRule({
    name: "no-example--do-something-else",
    meta: {
      type: "problem",
      docs: {
        description: "Report every debugger statement.",
        relatedGuidelines: ["docs/guidelines/example.md"],
      },
      messages: {
        first: "Stop doing this.",
        second: "Stop doing that as well.   ",
      },
      schema: [],
    },
    create(context) {
      return {
        DebuggerStatement(node) {
          context.report({ node, messageId: "first" });
        },
      };
    },
  });

  test("the transform points the canonical document pointer at the generated rule document", () => {
    const docs: WorkspaceLintRuleDocs = rule.meta.docs;

    expect(docs.url).toBe(
      "https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-example--do-something-else.md",
    );
  });

  test("the transform appends a repository relative pointer to every message body", () => {
    expect(rule.meta.messages).toStrictEqual({
      first: "Stop doing this. See packages/example/docs/lint/no-example--do-something-else.md.",
      second:
        "Stop doing that as well. See packages/example/docs/lint/no-example--do-something-else.md.",
    });
  });

  test("the transform keeps every message id the author declared reachable by name", () => {
    expect(rule.meta.messages.first).toContain("Stop doing this.");
    expect(rule.meta.messages.second).toContain("Stop doing that as well.");
  });

  test("the transform keeps the description and the related guidelines the author wrote", () => {
    expect(rule.meta.docs.description).toBe("Report every debugger statement.");
    expect(rule.meta.docs.relatedGuidelines).toStrictEqual(["docs/guidelines/example.md"]);
  });

  test("the transform keeps the rule name so the plugin map and the document agree", () => {
    expect(rule.name).toBe("no-example--do-something-else");
  });
});
