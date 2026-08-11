import { jobEntriesOf } from "../steps.ts";
import { entryOf, keyOf, lineOf, type WorkflowDocument } from "../workflow-document.ts";

import type { WorkflowChecksConfig } from "../config.ts";
import type { WorkflowProblem } from "../problem.ts";

export const undeclaredPermissions = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowProblem[] => {
  if (entryOf(document.root, config.permissionsKey) !== null) return [];

  return jobEntriesOf({ document, config }).flatMap((job) => {
    if (entryOf(job.value, config.permissionsKey) !== null) return [];

    return [
      {
        file: document.relativePath,
        line: lineOf(document, job.key),
        message: `A job must not run on whatever the platform hands it by default, because declaring nothing records that the permissions were never examined rather than that they were found sufficient. Declare ${config.permissionsKey} on this workflow or on the job ${keyOf(job) ?? ""}, naming only what the run reads or writes.`,
      },
    ];
  });
};
