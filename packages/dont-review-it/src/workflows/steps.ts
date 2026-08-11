import {
  entriesOf,
  entryOf,
  itemsOf,
  valueOf,
  type WorkflowDocument,
} from "./workflow-document.ts";

import type { Pair } from "yaml";
import type { WorkflowChecksConfig } from "./config.ts";

export const jobEntriesOf = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly Pair[] => entriesOf(valueOf(document.root, config.jobsKey));

export const stepsOf = ({
  job,
  config,
}: {
  readonly job: unknown;
  readonly config: WorkflowChecksConfig;
}): readonly unknown[] => itemsOf(valueOf(job, config.stepsKey));

export const entriesNamedInSteps = ({
  document,
  config,
  key,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
  readonly key: string;
}): readonly Pair[] =>
  jobEntriesOf({ document, config }).flatMap((job) =>
    stepsOf({ job: job.value, config }).flatMap((step) => {
      const entry = entryOf(step, key);
      return entry === null ? [] : [entry];
    }),
  );

export const triggersOf = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): unknown => valueOf(document.root, config.triggersKey);
