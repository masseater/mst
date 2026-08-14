import { join } from "node:path";

import { lintRuleFactsIn, type LintRuleFacts } from "./rule-facts.ts";
import { ruleSourceFilesIn } from "./rule-source-files.ts";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

export const workspaceRulesOf = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): readonly LintRuleFacts[] =>
  ruleSourceFilesIn({ repositoryRoot, workspace }).flatMap((sourcePath) =>
    lintRuleFactsIn({
      workspaceRoot: join(repositoryRoot, workspace.workspaceDir),
      sourcePath,
    }),
  );
