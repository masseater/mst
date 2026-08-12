import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readUnlessMissing, type ScannedProblems } from "@mst/repository-checks";

import {
  itemsOf,
  parseWorkflowDocument,
  scalarText,
  valueOf,
  type WorkflowDocument,
} from "./workflow-document.ts";

import type { WorkflowChecksConfig } from "./config.ts";

const firstReadable = ({
  repositoryRoot,
  paths,
}: {
  readonly repositoryRoot: string;
  readonly paths: readonly string[];
}): WorkflowDocument | null =>
  paths.flatMap((relativePath) => {
    const source = readUnlessMissing(() =>
      readFileSync(join(repositoryRoot, relativePath), "utf8"),
    );
    return source === null ? [] : [parseWorkflowDocument({ relativePath, source })];
  })[0] ?? null;

const coversActions = ({
  definition,
  config,
}: {
  readonly definition: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): boolean =>
  itemsOf(valueOf(definition.root, config.updatesKey)).some(
    (update) => scalarText(valueOf(update, config.packageEcosystemKey)) === config.actionsEcosystem,
  );

export const actionUpdateProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): ScannedProblems => {
  if (firstReadable({ repositoryRoot, paths: config.renovateConfigPaths }) !== null) {
    return { problems: [], scanned: 1 };
  }

  const definition = firstReadable({ repositoryRoot, paths: config.dependabotConfigPaths });
  if (definition === null) {
    return {
      problems: [
        {
          file: config.workflowDirectory,
          line: null,
          message: `A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose \`${config.updatesKey}\` cover the \`${config.actionsEcosystem}\` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.`,
        },
      ],
      scanned: 0,
    };
  }

  if (coversActions({ definition, config })) return { problems: [], scanned: 1 };

  return {
    problems: [
      {
        file: definition.relativePath,
        line: 1,
        message: `A dependency update configuration must not leave the workflows out, because the actions they pin run with more access than anything else in the repository and are read by nobody once pinned. Add an entry to \`${config.updatesKey}\` whose \`${config.packageEcosystemKey}\` is \`${config.actionsEcosystem}\`, so the pinned commit SHAs are raised alongside the rest of the dependencies.`,
      },
    ],
    scanned: 1,
  };
};
