import { join } from "node:path";

import { countBy } from "es-toolkit";

import { generatedFileProblems, staleGeneratedFile } from "../reconcile-generated-file.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import { lintRuleWorkspacesIn, type LintRuleWorkspace } from "./lint-rule-workspaces.ts";
import { renderRuleIndex } from "./render-rule-index.ts";
import { bundleNamesIn } from "./rule-bundle.ts";
import { shippedRuleReferenceProblems } from "./shipped-rule-reference.ts";
import { workspaceRulesOf } from "./workspace-rules.ts";

import type { LintRuleCheckReport, LintRuleProblem } from "../lint-rule-problem.ts";

const BEGIN_MARKER = "<!-- BEGIN GENERATED lint-rules -->";

const END_MARKER = "<!-- END GENERATED lint-rules -->";

const scaffoldOf = (block: string): string =>
  `# Lint rule index\n\nEvery lint rule this workspace implements. Generated from the rule sources; refresh it with \`${REGENERATE_COMMAND}\` rather than editing it.\n\n${block}\n`;

const missingIndex = (file: string): string =>
  `A workspace that declares lint rules must not go without \`${file}\`. Generate it with \`${REGENERATE_COMMAND}\`.`;

const staleIndex = (file: string): string =>
  staleGeneratedFile({ file, behind: "the rule implementations" });

const duplicatedRuleName = ({
  ruleName,
  workspaceDir,
}: {
  readonly ruleName: string;
  readonly workspaceDir: string;
}): string =>
  `Two rules in \`${workspaceDir}\` must not share the name \`${ruleName}\`; they claim the same document. Rename one of them.`;

const unbundledShippedRule = ({
  ruleName,
  workspaceDir,
}: {
  readonly ruleName: string;
  readonly workspaceDir: string;
}): string =>
  `A rule the preset carries must not sit outside a bundle directory once \`${workspaceDir}\` declares bundles. Move \`${ruleName}\` under the directory of the bundle that carries it, or declare \`shipped: false\` on it.`;

const reconcileWorkspace = ({
  repositoryRoot,
  workspace,
  write,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly write: boolean;
}): readonly LintRuleProblem[] => {
  const file = join(workspace.workspaceDir, "docs", "lint", "index.md");
  const rules = workspaceRulesOf({ repositoryRoot, workspace });

  const duplicates = Object.entries(countBy(rules, (rule) => rule.name))
    .filter(([, spellings]) => spellings > 1)
    .map(([ruleName]) => ({
      file,
      message: duplicatedRuleName({ ruleName, workspaceDir: workspace.workspaceDir }),
    }));

  const strays =
    bundleNamesIn(rules).length === 0
      ? []
      : rules
          .filter((rule) => rule.shipped && rule.bundle === null)
          .map((rule) => ({
            file: join(workspace.workspaceDir, rule.sourcePath),
            message: unbundledShippedRule({
              ruleName: rule.name,
              workspaceDir: workspace.workspaceDir,
            }),
          }));

  return [
    ...duplicates,
    ...strays,
    ...generatedFileProblems({
      repositoryRoot,
      file,
      begin: BEGIN_MARKER,
      end: END_MARKER,
      expected: renderRuleIndex(rules),
      scaffold: scaffoldOf,
      absent: missingIndex,
      stale: staleIndex,
      write,
    }),
    ...shippedRuleReferenceProblems({
      repositoryRoot,
      workspaceDir: workspace.workspaceDir,
      rules,
      write,
    }),
  ];
};

export const lintRuleIndexProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): LintRuleCheckReport => {
  const workspaces = lintRuleWorkspacesIn(repositoryRoot);
  return {
    problems: workspaces.flatMap((workspace) =>
      reconcileWorkspace({ repositoryRoot, workspace, write }),
    ),
    scanned: workspaces.length,
  };
};
