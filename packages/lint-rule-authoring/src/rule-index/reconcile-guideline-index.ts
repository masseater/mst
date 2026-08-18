import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  normativeDocumentPlacesIn,
  normativeDocumentsIn,
  readUnlessMissing,
} from "@mst/repository-checks";

import { generatedFileProblems, staleGeneratedFile } from "../reconcile-generated-file.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import { lintRuleWorkspacesIn } from "./lint-rule-workspaces.ts";
import { renderGuidelineIndex, type GroundedLintRule } from "./render-guideline-index.ts";
import { workspaceRulesOf } from "./workspace-rules.ts";

import type { LintRuleCheckReport } from "../lint-rule-problem.ts";

const GUIDELINE_INDEX_PATH = "docs/lint-rules-by-guideline.md";

const BEGIN_MARKER = "<!-- BEGIN GENERATED rules-by-guideline -->";

const END_MARKER = "<!-- END GENERATED rules-by-guideline -->";

const scaffoldOf = (block: string): string =>
  `# Rules by normative document\n\nWhich lint rules of this repository declare each normative document as their grounds. Collected from those declarations alone, so what the off-the-shelf rules and the other checks cover is not in it. Generated; refresh it with \`${REGENERATE_COMMAND}\` rather than editing it.\n\n${block}\n`;

const strandedIndex = (file: string): string =>
  `\`${file}\` must not stand while nothing keeps it fresh. This repository declares no place for its normative documents, so nothing regenerates the table. Declare \`normativeDocuments\` in the root manifest, or delete the table.`;

const missingIndex = (file: string): string =>
  `A repository whose rules name their grounds must not go without \`${file}\`. Generate it with \`${REGENERATE_COMMAND}\`.`;

const staleIndex = (file: string): string =>
  staleGeneratedFile({ file, behind: "the grounds its rules declare" });

export const guidelineIndexProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): LintRuleCheckReport => {
  const grounded: readonly GroundedLintRule[] = lintRuleWorkspacesIn(repositoryRoot).flatMap(
    (workspace) =>
      workspaceRulesOf({ repositoryRoot, workspace }).map((rule) => ({
        rule,
        workspaceDir: workspace.workspaceDir,
      })),
  );
  const normativeDocuments = normativeDocumentsIn({
    repositoryRoot,
    places: normativeDocumentPlacesIn(repositoryRoot),
    workspaceDirectories: lintRuleWorkspacesIn(repositoryRoot).map(
      (workspace) => workspace.workspaceDir,
    ),
  });
  if (normativeDocuments.length === 0) {
    return {
      problems:
        readUnlessMissing(() =>
          readFileSync(join(repositoryRoot, GUIDELINE_INDEX_PATH), "utf8"),
        ) === null
          ? []
          : [{ file: GUIDELINE_INDEX_PATH, message: strandedIndex(GUIDELINE_INDEX_PATH) }],
      scanned: 0,
    };
  }

  return {
    problems: generatedFileProblems({
      repositoryRoot,
      file: GUIDELINE_INDEX_PATH,
      begin: BEGIN_MARKER,
      end: END_MARKER,
      expected: renderGuidelineIndex({ normativeDocuments, grounded }),
      scaffold: scaffoldOf,
      absent: missingIndex,
      stale: staleIndex,
      write,
    }),
    scanned: normativeDocuments.length,
  };
};
