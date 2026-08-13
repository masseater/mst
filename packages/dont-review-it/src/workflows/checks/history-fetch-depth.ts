import { entriesNamedInSteps } from "../steps.ts";
import { entryOf, lineOf, scalarValueText, type WorkflowDocument } from "../workflow-document.ts";

import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

const UNBOUNDED_DEPTH = "0";

export const unboundedHistoryFetches = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] =>
  entriesNamedInSteps({ document, config, key: config.withKey }).flatMap((inputs) => {
    const depthEntry = entryOf(inputs.value, config.fetchDepthKey);
    if (depthEntry === null || scalarValueText(depthEntry.value) !== UNBOUNDED_DEPTH) return [];

    return [
      {
        file: document.relativePath,
        line: lineOf(document, depthEntry.key),
        message: `A checkout must not ask for the whole history, because ${UNBOUNDED_DEPTH} transfers every commit ever made and that amount grows with the age of the repository rather than with anything this run does. A run that was fast when the rule was written gets slower every month while its definition stays the same. Read the history through the GitHub API instead and leave \`${config.fetchDepthKey}\` at a bounded number: compare two refs to decide whether one descends from the other, list commits between two points, and read tags through the refs endpoint. Each of those answers one question in one request. Deepening the clone afterwards or fetching without blobs keeps the transfer tied to the size of the repository and is not a way out of this.`,
      },
    ];
  });
