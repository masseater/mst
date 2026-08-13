import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { undeclaredPermissions } from "./declared-permissions.ts";

const DEMAND = `A job must not run on whatever the platform hands it by default, because declaring nothing records that the permissions were never examined rather than that they were found sufficient. Declare permissions on this workflow or on the job`;

describe("undeclaredPermissions", () => {
  describe("a job that states nothing about what it may reach", () => {
    const it = test.extend("problems", () =>
      undeclaredPermissions({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported by name", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 2,
          message: `${DEMAND} build, naming only what the run reads or writes.`,
        },
      ]);
    });
  });

  describe("a declaration made once for the whole workflow", () => {
    const it = test.extend("problems", () =>
      undeclaredPermissions({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "permissions:\n  contents: read\njobs:\n  build:\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is accepted", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a declaration made by the job itself", () => {
    const it = test.extend("problems", () =>
      undeclaredPermissions({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    permissions:\n      contents: read\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is accepted", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a job that left it unstated beside a job that declared it", () => {
    const it = test.extend("problems", () =>
      undeclaredPermissions({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    permissions:\n      contents: read\n    steps: []\n  test:\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is the only one reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 6,
          message: `${DEMAND} test, naming only what the run reads or writes.`,
        },
      ]);
    });
  });

  describe("a job whose key is not a plain value", () => {
    const it = test.extend("problems", () =>
      undeclaredPermissions({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  ? [build]\n  : {}\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is still reported, with nothing standing in for the name", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 2,
          message: `${DEMAND} , naming only what the run reads or writes.`,
        },
      ]);
    });
  });
});
