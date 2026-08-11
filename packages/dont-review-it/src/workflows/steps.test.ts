import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import {
  entriesNamedInSteps,
  jobEntriesOf,
  stepsOf,
  triggerKeyNodeOf,
  triggerNamesOf,
  triggersOf,
} from "./steps.ts";
import {
  keyOf,
  keysOf,
  lineOf,
  parseWorkflowDocument,
  scalarText,
  valueOf,
} from "./workflow-document.ts";

const config = defaultWorkflowChecksConfig;

const documentOf = (source: string) =>
  parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source });

const TWO_JOBS = `jobs:
  build:
    steps:
      - run: vp run build
      - uses: actions/checkout@v5
  test:
    steps:
      - run: vp run test
`;

describe("jobEntriesOf", () => {
  it("lists every job the workflow declares", () => {
    expect(jobEntriesOf({ document: documentOf(TWO_JOBS), config }).map(keyOf)).toStrictEqual([
      "build",
      "test",
    ]);
  });

  it("lists nothing when the workflow declares no jobs", () => {
    expect(jobEntriesOf({ document: documentOf("name: CI\n"), config })).toStrictEqual([]);
  });
});

describe("stepsOf", () => {
  it("lists the steps of a job", () => {
    const [build] = jobEntriesOf({ document: documentOf(TWO_JOBS), config });

    expect(stepsOf({ job: build?.value, config }).length).toBe(2);
  });
});

describe("entriesNamedInSteps", () => {
  it("collects the named entry from the steps of every job", () => {
    expect(
      entriesNamedInSteps({ document: documentOf(TWO_JOBS), config, key: config.runKey }).map(
        (entry) => scalarText(entry.value),
      ),
    ).toStrictEqual(["vp run build", "vp run test"]);
  });

  it("skips the steps that do not declare the entry", () => {
    expect(
      entriesNamedInSteps({ document: documentOf(TWO_JOBS), config, key: "uses" }).length,
    ).toBe(1);
  });
});

describe("triggersOf", () => {
  it("reads the triggers the workflow declares", () => {
    expect(keysOf(triggersOf({ document: documentOf("on:\n  push:\n"), config }))).toStrictEqual([
      "push",
    ]);
  });

  it("reads nothing from a workflow that declares no triggers", () => {
    expect(triggersOf({ document: documentOf("name: CI\n"), config })).toBeNull();
  });

  it("does not confuse the triggers with another key", () => {
    expect(
      valueOf(triggersOf({ document: documentOf("on:\n  push:\n"), config }), "jobs"),
    ).toBeNull();
  });
});

describe("triggerNamesOf", () => {
  it("names the triggers written as a mapping", () => {
    expect(
      triggerNamesOf({ document: documentOf("on:\n  push:\n  pull_request:\n"), config }),
    ).toStrictEqual(["push", "pull_request"]);
  });

  it("names the triggers written as a list", () => {
    expect(
      triggerNamesOf({ document: documentOf("on: [push, workflow_call]\n"), config }),
    ).toStrictEqual(["push", "workflow_call"]);
  });

  it("names the single trigger written on its own", () => {
    expect(triggerNamesOf({ document: documentOf("on: push\n"), config })).toStrictEqual(["push"]);
  });

  it("drops the items of a list that are not plain values", () => {
    expect(
      triggerNamesOf({ document: documentOf("on: [push, [nested]]\n"), config }),
    ).toStrictEqual(["push"]);
  });

  it("names nothing when the workflow declares no triggers", () => {
    expect(triggerNamesOf({ document: documentOf("name: CI\n"), config })).toStrictEqual([]);
  });
});

describe("triggerKeyNodeOf", () => {
  it("points at the trigger itself when it was written as a mapping", () => {
    const document = documentOf("name: CI\non:\n  push:\n  workflow_call:\n");

    expect(lineOf(document, triggerKeyNodeOf({ document, config, name: "workflow_call" }))).toBe(4);
  });

  it("points at the declaration of the triggers when they were written as a list", () => {
    const document = documentOf("name: CI\non: [push, workflow_call]\n");

    expect(lineOf(document, triggerKeyNodeOf({ document, config, name: "workflow_call" }))).toBe(2);
  });
});
