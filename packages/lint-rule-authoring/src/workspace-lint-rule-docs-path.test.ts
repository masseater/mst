import { describe, expect, test } from "vite-plus/test";

import {
  workspaceLintRuleDocsRelativePath,
  workspaceLintRuleDocsUrl,
} from "./workspace-lint-rule-docs-path.ts";

describe("workspaceLintRuleDocsRelativePath", () => {
  describe("a rule declared by a workspace", () => {
    const it = test.extend("path", () =>
      workspaceLintRuleDocsRelativePath({
        workspaceDir: "packages/example",
        ruleName: "no-example--do-something-else",
      }));

    it("puts the document under the document directory of the workspace that declares it", ({
      path,
    }) => {
      expect(path).toBe("packages/example/docs/lint/no-example--do-something-else.md");
    });
  });
});

describe("workspaceLintRuleDocsUrl", () => {
  describe("a rule declared by a workspace", () => {
    const it = test.extend("url", () =>
      workspaceLintRuleDocsUrl({
        workspaceDir: "packages/example",
        ruleName: "no-example--do-something-else",
      }));

    it("points at the document with an absolute repository URL", ({ url }) => {
      expect(url).toBe(
        "https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-example--do-something-else.md",
      );
    });
  });
});
