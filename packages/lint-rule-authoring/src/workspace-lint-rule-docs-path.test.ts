import { describe, expect, test } from "vite-plus/test";

import {
  workspaceLintRuleDocsRelativePath,
  workspaceLintRuleDocsUrl,
} from "./workspace-lint-rule-docs-path.ts";

const it = test
  .extend("docsRelativePath", () =>
    workspaceLintRuleDocsRelativePath({
      workspaceDir: "packages/example",
      ruleName: "no-example--do-something-else",
    }))
  .extend("docsUrl", () =>
    workspaceLintRuleDocsUrl({
      workspaceDir: "packages/example",
      ruleName: "no-example--do-something-else",
    }),
  );

describe("workspace-lint-rule-docs-path", () => {
  it("the document lives under the workspace document directory", ({ docsRelativePath }) => {
    expect(docsRelativePath).toBe("packages/example/docs/lint/no-example--do-something-else.md");
  });

  it("the canonical pointer is an absolute repository URL", ({ docsUrl }) => {
    expect(docsUrl).toBe(
      "https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-example--do-something-else.md",
    );
  });
});
