import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { maskedFailures } from "./masked-failure.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  maskedFailures({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

describe("maskedFailures", () => {
  it("finds the operator through the spacing it was written with", () => {
    expect(
      problemsFor(
        "jobs:\n  build:\n    steps:\n      - run: |\n          npm test ||\n            exit 0\n",
      )[0]?.message,
    ).toContain("|| exit 0");
  });

  it("reports a job that is allowed to fail", () => {
    expect(
      problemsFor("jobs:\n  build:\n    continue-on-error: true\n    steps: []\n").length,
    ).toBe(1);
  });

  it("reports a step that is allowed to fail", () => {
    expect(
      problemsFor("jobs:\n  build:\n    steps:\n      - continue-on-error: true\n").length,
    ).toBe(1);
  });

  it("leaves a job that declares it must not fail alone", () => {
    expect(
      problemsFor("jobs:\n  build:\n    continue-on-error: false\n    steps: []\n"),
    ).toStrictEqual([]);
  });

  it("reports a script that swallows the status of its command", () => {
    expect(
      problemsFor("jobs:\n  build:\n    steps:\n      - run: npm test || true\n")[0]?.message,
    ).toContain("|| true");
  });

  it("leaves a script that lets the status stand alone", () => {
    expect(problemsFor("jobs:\n  build:\n    steps:\n      - run: npm test\n")).toStrictEqual([]);
  });

  it("leaves a step that declares no script alone", () => {
    expect(problemsFor("jobs:\n  build:\n    steps:\n      - run:\n")).toStrictEqual([]);
  });
});
