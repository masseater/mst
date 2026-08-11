import { triggerKeyNodeOf, triggerNamesOf } from "../steps.ts";
import { lineOf, type WorkflowDocument } from "../workflow-document.ts";

import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

export const reusableWorkflowTriggers = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] => {
  const declared = triggerNamesOf({ document, config });
  if (!declared.includes(config.reusableTrigger)) return [];

  const owned = declared.filter((name) => name !== config.reusableTrigger);
  if (owned.length === 0) return [];

  return [
    {
      file: document.relativePath,
      line: lineOf(document, triggerKeyNodeOf({ document, config, name: config.reusableTrigger })),
      message: `A part that other workflows call must not own a trigger of its own, because the permissions and the concurrency it declares then apply to runs no caller asked for. Drop ${owned.join(", ")} from this file, and leave the start to the workflow that calls it.`,
    },
  ];
};
