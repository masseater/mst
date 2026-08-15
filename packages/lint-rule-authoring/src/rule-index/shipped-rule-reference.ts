import { existsSync } from "node:fs";
import { join } from "node:path";

import { generatedFileProblems, staleGeneratedFile } from "../reconcile-generated-file.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import { renderShippedRuleReference } from "./render-shipped-rule-reference.ts";

import type { LintRuleProblem } from "../lint-rule-problem.ts";
import type { LintRuleFacts } from "./rule-facts.ts";

const BEGIN_MARKER = "<!-- BEGIN GENERATED shipped-lint-rules -->";

const END_MARKER = "<!-- END GENERATED shipped-lint-rules -->";

const SKILL_DIRECTORY = join("skills", "core");

const REFERENCE_FILE = join(SKILL_DIRECTORY, "references", "lint-rules.md");

const scaffoldOf = (block: string): string =>
  `# Lint rules this package ships\n\nEvery rule below is registered at error severity unless the table says the preset leaves it off. Generated from the rule implementations; regenerate with \`${REGENERATE_COMMAND}\` rather than editing it.\n\n${block}\n`;

const missingReference = (file: string): string =>
  `A package that ships both lint rules and agent skills must not go without \`${file}\`, because the rule documents stay in the repository and never reach an installed copy. Generate it with \`${REGENERATE_COMMAND}\`.`;

const staleReference = (file: string): string =>
  staleGeneratedFile({ file, behind: "the rule implementations it lists" });

export const shippedRuleReferenceProblems = ({
  repositoryRoot,
  workspaceDir,
  rules,
  write,
}: {
  readonly repositoryRoot: string;
  readonly workspaceDir: string;
  readonly rules: readonly LintRuleFacts[];
  readonly write: boolean;
}): readonly LintRuleProblem[] => {
  const skillPath = join(repositoryRoot, workspaceDir, SKILL_DIRECTORY, "SKILL.md");
  if (!existsSync(skillPath)) return [];

  return generatedFileProblems({
    repositoryRoot,
    file: join(workspaceDir, REFERENCE_FILE),
    begin: BEGIN_MARKER,
    end: END_MARKER,
    expected: renderShippedRuleReference({ rules, workspaceDir }),
    scaffold: scaffoldOf,
    absent: missingReference,
    stale: staleReference,
    write,
  });
};
