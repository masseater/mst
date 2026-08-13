import { triggersOf } from "../steps.ts";
import { entriesOf, keyOf, lineOf, valueOf, type WorkflowDocument } from "../workflow-document.ts";

import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

export const gatingTriggerFilters = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] => {
  const triggers = triggersOf({ document, config });

  return config.gatingTriggers.flatMap((trigger) =>
    entriesOf(valueOf(triggers, trigger)).flatMap((listed) => {
      const named = keyOf(listed);
      if (named === null || !config.narrowingKeys.includes(named)) return [];

      return [
        {
          file: document.relativePath,
          line: lineOf(document, listed.key),
          message: `A workflow that branch protection can require must not narrow its own start with ${named} under ${trigger}, because a run that never starts has no result to distinguish from a passing one. Drop ${named} from the trigger, and express the narrowing in the if of a job or a step so the run still reports.`,
        },
      ];
    }),
  );
};
