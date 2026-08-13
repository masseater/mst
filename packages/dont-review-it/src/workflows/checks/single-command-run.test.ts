import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { multiCommandRuns } from "./single-command-run.ts";

const MORE_THAN_ONE_CALL = `A run block must not hold more than one command call, because branching, retrying, looping and target discovery placed here run only inside this file and carry neither types nor tests. Move the logic into a command in this repository, and call that command once from here.`;

describe("multiCommandRuns", () => {
  describe("a run block that holds one call", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: vp run guard\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("two calls written on their own lines", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - run: |\n          vp run build\n          vp run test\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("are reported once, beside the line the script was declared on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: MORE_THAN_ONE_CALL },
      ]);
    });
  });

  describe("two calls joined by an operator", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: vp run build && vp run test\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("are reported once, beside the line the script was declared on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: MORE_THAN_ONE_CALL },
      ]);
    });
  });

  describe("a loop", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - run: for name in one two; do echo $name; done\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported once, beside the line the script was declared on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: MORE_THAN_ONE_CALL },
      ]);
    });
  });

  describe("a control keyword standing on its own", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: if\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported once, beside the line the script was declared on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: MORE_THAN_ONE_CALL },
      ]);
    });
  });

  describe("a call whose name merely starts with a control keyword", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: iffy-command --run\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a call that was wrapped across lines", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - run: |\n          vp run \\\n            guard\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("the blank lines and the comments around a call", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - run: |\n          # explain\n          \n          vp run guard\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("are left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a step that declares no script", () => {
    const it = test.extend("problems", () =>
      multiCommandRuns({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
