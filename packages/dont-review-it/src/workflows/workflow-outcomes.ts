import { actionUpdateProblems } from "./action-updates.ts";
import { runWorkflowChecks } from "./run-workflow-checks.ts";

import type { ScannedProblems } from "@mst/repository-checks";
import type { WorkflowChecksConfig } from "./config.ts";

export type WorkflowOutcomes = {
  readonly definitions: ScannedProblems;
  readonly updates: ScannedProblems;
};

export const workflowOutcomesOf = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): WorkflowOutcomes => {
  const definitions = runWorkflowChecks({ repositoryRoot, config });

  return {
    definitions,
    updates:
      definitions.scanned === 0
        ? { problems: [], scanned: 0 }
        : actionUpdateProblems({ repositoryRoot, config }),
  };
};
