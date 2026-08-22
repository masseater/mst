import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";

import { parseWorkflowDocument, type WorkflowDocument } from "./workflow-document.ts";

import type { WorkflowChecksConfig } from "./config.ts";

export const readWorkflowDocuments = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowDocument[] => {
  const directory = join(repositoryRoot, config.workflowDirectory);
  const entryNames = readUnlessMissing(() => readdirSync(directory)) ?? [];

  return entryNames
    .filter((spelled) =>
      config.workflowFileExtensions.some((extension) => spelled.endsWith(extension)),
    )
    .toSorted()
    .map((spelled) =>
      parseWorkflowDocument({
        relativePath: `${config.workflowDirectory}/${spelled}`,
        source: readFileSync(join(directory, spelled), "utf8"),
      }),
    );
};
