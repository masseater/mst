import { jobEntriesOf, stepsOf } from "../steps.ts";
import {
  entryOf,
  lineOf,
  scalarText,
  trailingComment,
  type WorkflowDocument,
} from "../workflow-document.ts";

import type { Pair } from "yaml";
import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

const REFERENCE_SEPARATOR = "@";

const CARRIES_ITS_OWN_COMMIT = ["./", "docker://"];

const referenceEntries = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly Pair[] => {
  const jobs = jobEntriesOf({ document, config });
  const holders = [
    ...jobs.map((job) => job.value),
    ...jobs.flatMap((job) => stepsOf({ job: job.value, config })),
  ];

  return holders.flatMap((holder) => {
    const referenceEntry = entryOf(holder, config.usesKey);
    return referenceEntry === null ? [] : [referenceEntry];
  });
};

const refOf = (reference: string): string => {
  const separator = reference.lastIndexOf(REFERENCE_SEPARATOR);
  return separator === -1 ? "" : reference.slice(separator + 1);
};

export const unpinnedActionRefs = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] =>
  referenceEntries({ document, config }).flatMap((actionEntry) => {
    const reference = scalarText(actionEntry.value);
    if (reference === null) return [];
    if (CARRIES_ITS_OWN_COMMIT.some((prefix) => reference.startsWith(prefix))) return [];

    const line = lineOf(document, actionEntry.key);
    if (!COMMIT_SHA_PATTERN.test(refOf(reference))) {
      return [
        {
          file: document.relativePath,
          line,
          message: `An action reference must not end in a tag or a branch, because both move: \`${reference}\` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after \`${REFERENCE_SEPARATOR}\` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.`,
        },
      ];
    }

    if (trailingComment(actionEntry.value) !== null) return [];

    return [
      {
        file: document.relativePath,
        line,
        message: `A pinned action reference must not stand without the version it pins, because a bare commit SHA leaves nothing to read: neither what this step runs today, nor what an update to it changed. Write the released version beside the SHA as a trailing comment, in the form \`owner/repo${REFERENCE_SEPARATOR}<sha> # v1.2.3\`.`,
      },
    ];
  });
