import { describe, expect, test } from "vite-plus/test";

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

describe("jobEntriesOf", () => {
  describe("a workflow declaring more than one job", () => {
    const it = test.extend("jobNames", () =>
      jobEntriesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:
  build:
    steps:
      - run: vp run build
      - uses: actions/checkout@v5
  test:
    steps:
      - run: vp run test
`,
        }),
        config: defaultWorkflowChecksConfig,
      }).map(keyOf));

    it("lists every job the workflow declares", ({ jobNames }) => {
      expect(jobNames).toStrictEqual(["build", "test"]);
    });
  });

  describe("a workflow declaring no jobs", () => {
    const it = test.extend("jobEntries", () =>
      jobEntriesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("lists nothing at all", ({ jobEntries }) => {
      expect(jobEntries).toStrictEqual([]);
    });
  });
});

describe("stepsOf", () => {
  describe("a job declaring more than one step", () => {
    const it = test.extend("stepKeys", () => {
      const [buildJob] = jobEntriesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:
  build:
    steps:
      - run: vp run build
      - uses: actions/checkout@v5
  test:
    steps:
      - run: vp run test
`,
        }),
        config: defaultWorkflowChecksConfig,
      });

      return stepsOf({ job: buildJob?.value, config: defaultWorkflowChecksConfig }).map(keysOf);
    });

    it("lists the steps of the job", ({ stepKeys }) => {
      expect(stepKeys).toStrictEqual([["run"], ["uses"]]);
    });
  });
});

describe("entriesNamedInSteps", () => {
  describe("a key that a step of every job declares", () => {
    const it = test.extend("commands", () =>
      entriesNamedInSteps({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:
  build:
    steps:
      - run: vp run build
      - uses: actions/checkout@v5
  test:
    steps:
      - run: vp run test
`,
        }),
        config: defaultWorkflowChecksConfig,
        key: defaultWorkflowChecksConfig.runKey,
      }).map((entry) => scalarText(entry.value)));

    it("collects the named entry from the steps of every job", ({ commands }) => {
      expect(commands).toStrictEqual(["vp run build", "vp run test"]);
    });
  });

  describe("a key that only one step declares", () => {
    const it = test.extend("actions", () =>
      entriesNamedInSteps({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:
  build:
    steps:
      - run: vp run build
      - uses: actions/checkout@v5
  test:
    steps:
      - run: vp run test
`,
        }),
        config: defaultWorkflowChecksConfig,
        key: "uses",
      }).map((entry) => scalarText(entry.value)));

    it("skips the steps that do not declare the entry", ({ actions }) => {
      expect(actions).toStrictEqual(["actions/checkout@v5"]);
    });
  });
});

describe("triggersOf", () => {
  describe("a workflow declaring its triggers", () => {
    const it = test.extend("triggerKeys", () =>
      keysOf(
        triggersOf({
          document: parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "on:\n  push:\n",
          }),
          config: defaultWorkflowChecksConfig,
        }),
      ));

    it("reads the triggers the workflow declares", ({ triggerKeys }) => {
      expect(triggerKeys).toStrictEqual(["push"]);
    });
  });

  describe("a workflow declaring no triggers", () => {
    const it = test.extend("triggers", () =>
      triggersOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reads nothing at all", ({ triggers }) => {
      expect(triggers).toBe(null);
    });
  });

  describe("a name the triggers do not declare", () => {
    const it = test.extend("jobsUnderTriggers", () =>
      valueOf(
        triggersOf({
          document: parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "on:\n  push:\n",
          }),
          config: defaultWorkflowChecksConfig,
        }),
        "jobs",
      ));

    it("does not confuse the triggers with another key", ({ jobsUnderTriggers }) => {
      expect(jobsUnderTriggers).toBe(null);
    });
  });
});

describe("triggerNamesOf", () => {
  describe("triggers written as a mapping", () => {
    const it = test.extend("triggerNames", () =>
      triggerNamesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  push:\n  pull_request:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("names every trigger the mapping declares", ({ triggerNames }) => {
      expect(triggerNames).toStrictEqual(["push", "pull_request"]);
    });
  });

  describe("triggers written as a list", () => {
    const it = test.extend("triggerNames", () =>
      triggerNamesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [push, workflow_call]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("names every trigger the list declares", ({ triggerNames }) => {
      expect(triggerNames).toStrictEqual(["push", "workflow_call"]);
    });
  });

  describe("a single trigger written on its own", () => {
    const it = test.extend("triggerNames", () =>
      triggerNamesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: push\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("names the trigger written on its own", ({ triggerNames }) => {
      expect(triggerNames).toStrictEqual(["push"]);
    });
  });

  describe("a list holding an item that is not a plain value", () => {
    const it = test.extend("triggerNames", () =>
      triggerNamesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [push, [nested]]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("drops the items of a list that are not plain values", ({ triggerNames }) => {
      expect(triggerNames).toStrictEqual(["push"]);
    });
  });

  describe("a workflow declaring no triggers", () => {
    const it = test.extend("triggerNames", () =>
      triggerNamesOf({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("names nothing at all", ({ triggerNames }) => {
      expect(triggerNames).toStrictEqual([]);
    });
  });
});

describe("triggerKeyNodeOf", () => {
  describe("a trigger written as a mapping", () => {
    const it = test.extend("line", () => {
      const document = parseWorkflowDocument({
        relativePath: ".github/workflows/ci.yml",
        source: "name: CI\non:\n  push:\n  workflow_call:\n",
      });

      return lineOf(
        document,
        triggerKeyNodeOf({ document, config: defaultWorkflowChecksConfig, name: "workflow_call" }),
      );
    });

    it("points at the trigger itself", ({ line }) => {
      expect(line).toBe(4);
    });
  });

  describe("a trigger written inside a list", () => {
    const it = test.extend("line", () => {
      const document = parseWorkflowDocument({
        relativePath: ".github/workflows/ci.yml",
        source: "name: CI\non: [push, workflow_call]\n",
      });

      return lineOf(
        document,
        triggerKeyNodeOf({ document, config: defaultWorkflowChecksConfig, name: "workflow_call" }),
      );
    });

    it("points at the declaration of the triggers", ({ line }) => {
      expect(line).toBe(2);
    });
  });
});
