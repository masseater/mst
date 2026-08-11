import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { undeclaredPermissions } from "./declared-permissions.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  undeclaredPermissions({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

describe("undeclaredPermissions", () => {
  it("reports the job that states nothing about what it may reach", () => {
    expect(problemsFor("jobs:\n  build:\n    steps: []\n")[0]?.message).toContain("build");
  });

  it("accepts a declaration made once for the whole workflow", () => {
    expect(
      problemsFor("permissions:\n  contents: read\njobs:\n  build:\n    steps: []\n"),
    ).toStrictEqual([]);
  });

  it("accepts a declaration made by the job itself", () => {
    expect(
      problemsFor("jobs:\n  build:\n    permissions:\n      contents: read\n    steps: []\n"),
    ).toStrictEqual([]);
  });

  it("reports only the job that left it unstated", () => {
    expect(
      problemsFor(
        "jobs:\n  build:\n    permissions:\n      contents: read\n    steps: []\n  test:\n    steps: []\n",
      ).length,
    ).toBe(1);
  });

  it("names the job even when its key is not a plain value", () => {
    expect(problemsFor("jobs:\n  ? [build]\n  : {}\n")[0]?.message).toContain(
      "Declare permissions",
    );
  });
});
