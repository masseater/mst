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
    .filter((name) => config.workflowFileExtensions.some((extension) => name.endsWith(extension)))
    .toSorted()
    .map((name) =>
      parseWorkflowDocument({
        relativePath: `${config.workflowDirectory}/${name}`,
        source: readFileSync(join(directory, name), "utf8"),
      }),
    );
};
