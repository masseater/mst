import {
  entriesOf,
  entryOf,
  itemsOf,
  keysOf,
  scalarText,
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

export const triggerNamesOf = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly string[] => {
  const triggers = triggersOf({ document, config });
  const only = scalarText(triggers);
  if (only !== null) return [only];

  return [
    ...itemsOf(triggers).flatMap((item) => {
      const name = scalarText(item);
      return name === null ? [] : [name];
    }),
    ...keysOf(triggers),
  ];
};

export const triggerKeyNodeOf = ({
  document,
  config,
  name,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
  readonly name: string;
}): unknown =>
  entryOf(triggersOf({ document, config }), name)?.key ??
  entryOf(document.root, config.triggersKey)?.key;
