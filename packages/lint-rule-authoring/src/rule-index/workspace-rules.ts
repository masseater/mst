import { join } from "node:path";

import { bundleNameOf, type BundledLintRule } from "./rule-bundle.ts";
import { lintRuleFactsIn } from "./rule-facts.ts";
import { ruleSourceFilesIn } from "./rule-source-files.ts";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

export const workspaceRulesOf = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): readonly BundledLintRule[] =>
  ruleSourceFilesIn({ repositoryRoot, workspace }).flatMap((sourcePath) =>
    lintRuleFactsIn({
      workspaceRoot: join(repositoryRoot, workspace.workspaceDir),
      sourcePath,
    }).map((rule) => ({
      ...rule,
      bundle: bundleNameOf({ sourcePath, ruleDirectories: workspace.ruleDirectories }),
    })),
  );
