import { entriesNamedInSteps, jobEntriesOf, stepsOf } from "../steps.ts";
import {
  entryOf,
  isTruthyScalar,
  lineOf,
  scalarText,
  type WorkflowDocument,
} from "../workflow-document.ts";

import type { Pair } from "yaml";
import type { RepositoryProblem } from "../../problem.ts";
import type { WorkflowChecksConfig } from "../config.ts";

const WHITESPACE_RUN_PATTERN = /\s+/gu;

const maskingSnippetIn = (script: string, config: WorkflowChecksConfig): string | undefined =>
  config.failureMaskingSnippets.find((snippet) =>
    script.replace(WHITESPACE_RUN_PATTERN, " ").includes(snippet),
  );

const continuedOnErrorEntries = ({
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
    const listed = entryOf(holder, config.continueOnErrorKey);
    return listed === null || !isTruthyScalar(listed.value) ? [] : [listed];
  });
};

export const maskedFailures = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] => [
  ...continuedOnErrorEntries({ document, config }).map((listed) => ({
    file: document.relativePath,
    line: lineOf(document, listed.key),
    message: `A failure must not be reported as a pass, and ${config.continueOnErrorKey} turns one into the other. Delete it, and let the failure stop the run. If the step is genuinely optional, move it out of the run that a gate counts.`,
  })),
  ...entriesNamedInSteps({ document, config, key: config.runKey }).flatMap((listed) => {
    const script = scalarText(listed.value);
    const snippet = script === null ? undefined : maskingSnippetIn(script, config);
    if (snippet === undefined) return [];

    return [
      {
        file: document.relativePath,
        line: lineOf(document, listed.key),
        message: `A failure must not be swallowed inside a run block, and ${snippet} swallows one. Delete it, and let the exit status of the command stand. If the command fails for a reason this run should tolerate, fix that in the command instead of here.`,
      },
    ];
  }),
];
