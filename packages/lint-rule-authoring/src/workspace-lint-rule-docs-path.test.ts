import { expect, test } from "vite-plus/test";

import {
  workspaceLintRuleDocsRelativePath,
  workspaceLintRuleDocsUrl,
} from "./workspace-lint-rule-docs-path.ts";

const identity = { workspaceDir: "packages/example", ruleName: "no-example--do-something-else" };

test("the document lives under the workspace document directory", () => {
  expect(workspaceLintRuleDocsRelativePath(identity)).toBe(
    "packages/example/docs/lint/no-example--do-something-else.md",
  );
});

test("the canonical pointer is an absolute repository URL", () => {
  expect(workspaceLintRuleDocsUrl(identity)).toBe(
    "https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-example--do-something-else.md",
  );
});
