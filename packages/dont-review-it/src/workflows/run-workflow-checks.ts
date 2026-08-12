import { crossWorkflowChains } from "./checks/cross-workflow-chain.ts";
import { undeclaredPermissions } from "./checks/declared-permissions.ts";
import { gatingTriggerFilters } from "./checks/gating-trigger-filter.ts";
import { maskedFailures } from "./checks/masked-failure.ts";
import { reusableWorkflowTriggers } from "./checks/reusable-workflow-trigger.ts";
import { multiCommandRuns } from "./checks/single-command-run.ts";
import { lineAtOffset, type WorkflowDocument } from "./workflow-document.ts";
import { readWorkflowDocuments } from "./workflow-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { WorkflowChecksConfig } from "./config.ts";

const unreadableDefinition = (document: WorkflowDocument): readonly RepositoryProblem[] =>
  document.parseFailureOffsets.map((offset) => ({
    file: document.relativePath,
    line: lineAtOffset(document, offset),
    message: `A workflow definition that does not parse must not stay in the repository, because every check below reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.`,
  }));

const problemsIn = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] => {
  const unreadable = unreadableDefinition(document);
  if (unreadable.length > 0) return unreadable;

  return [
    ...gatingTriggerFilters({ document, config }),
    ...reusableWorkflowTriggers({ document, config }),
    ...crossWorkflowChains({ document, config }),
    ...undeclaredPermissions({ document, config }),
    ...multiCommandRuns({ document, config }),
    ...maskedFailures({ document, config }),
  ];
};

const byLocation = (left: RepositoryProblem, right: RepositoryProblem): number =>
  left.file === right.file
    ? Number(left.line) - Number(right.line)
    : left.file.localeCompare(right.file);

export const runWorkflowChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] =>
  readWorkflowDocuments({ repositoryRoot, config })
    .flatMap((document) => problemsIn({ document, config }))
    .toSorted(byLocation);
