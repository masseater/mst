import { triggersOf } from "../steps.ts";
import { entriesOf, keyOf, lineOf, valueOf, type WorkflowDocument } from "../workflow-document.ts";

import type { WorkflowChecksConfig } from "../config.ts";
import type { WorkflowProblem } from "../problem.ts";

export const gatingTriggerFilters = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowProblem[] => {
  const triggers = triggersOf({ document, config });

  return config.gatingTriggers.flatMap((trigger) =>
    entriesOf(valueOf(triggers, trigger)).flatMap((entry) => {
      const key = keyOf(entry);
      if (key === null || !config.narrowingKeys.includes(key)) return [];

      return [
        {
          file: document.relativePath,
          line: lineOf(document, entry.key),
          message: `A workflow that branch protection can require must not narrow its own start with ${key} under ${trigger}, because a run that never starts has no result to distinguish from a passing one. Drop ${key} from the trigger, and express the narrowing in the if of a job or a step so the run still reports.`,
        },
      ];
    }),
  );
};
