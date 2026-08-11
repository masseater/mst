import { triggerKeyNodeOf, triggerNamesOf } from "../steps.ts";
import { lineOf, type WorkflowDocument } from "../workflow-document.ts";

import type { WorkflowChecksConfig } from "../config.ts";
import type { WorkflowProblem } from "../problem.ts";

export const crossWorkflowChains = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowProblem[] => {
  if (!triggerNamesOf({ document, config }).includes(config.crossWorkflowTrigger)) return [];

  return [
    {
      file: document.relativePath,
      line: lineOf(
        document,
        triggerKeyNodeOf({ document, config, name: config.crossWorkflowTrigger }),
      ),
      message: `Work that reads the result of other work must not be split across runs, and ${config.crossWorkflowTrigger} splits it. Move these jobs into the workflow whose result they consume, and order them with needs so the whole chain succeeds or fails as one.`,
    },
  ];
};
