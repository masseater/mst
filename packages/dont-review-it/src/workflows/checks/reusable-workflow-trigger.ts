import { triggersOf } from "../steps.ts";
import { entryOf, keysOf, lineOf, type WorkflowDocument } from "../workflow-document.ts";

import type { WorkflowChecksConfig } from "../config.ts";
import type { WorkflowProblem } from "../problem.ts";

export const reusableWorkflowTriggers = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowProblem[] => {
  const triggers = triggersOf({ document, config });
  const reusableEntry = entryOf(triggers, config.reusableTrigger);
  if (reusableEntry === null) return [];

  const owned = keysOf(triggers).filter((key) => key !== config.reusableTrigger);
  if (owned.length === 0) return [];

  return [
    {
      file: document.relativePath,
      line: lineOf(document, reusableEntry.key),
      message: `A part that other workflows call must not own a trigger of its own, because the permissions and the concurrency it declares then apply to runs no caller asked for. Drop ${owned.join(", ")} from this file, and leave the start to the workflow that calls it.`,
    },
  ];
};
