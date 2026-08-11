import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { multiCommandRuns } from "./single-command-run.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  multiCommandRuns({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

const stepRunning = (script: string): string =>
  `jobs:\n  build:\n    steps:\n      - run: ${script}\n`;

const stepRunningBlock = (script: string): string =>
  `jobs:\n  build:\n    steps:\n      - run: |\n${script
    .split("\n")
    .map((line) => `          ${line}`)
    .join("\n")}\n`;

describe("multiCommandRuns", () => {
  it("leaves a run block that holds one call alone", () => {
    expect(problemsFor(stepRunning("vp run guard"))).toStrictEqual([]);
  });

  it("reports two calls written on their own lines", () => {
    expect(problemsFor(stepRunningBlock("vp run build\nvp run test")).length).toBe(1);
  });

  it("reports two calls joined by an operator", () => {
    expect(problemsFor(stepRunning("vp run build && vp run test")).length).toBe(1);
  });

  it("reports a loop", () => {
    expect(problemsFor(stepRunning("for name in one two; do echo $name; done")).length).toBe(1);
  });

  it("reports a control keyword standing on its own", () => {
    expect(problemsFor(stepRunning("if")).length).toBe(1);
  });

  it("leaves a call whose name merely starts with a control keyword alone", () => {
    expect(problemsFor(stepRunning("iffy-command --run"))).toStrictEqual([]);
  });

  it("leaves a call that was wrapped across lines alone", () => {
    expect(problemsFor(stepRunningBlock("vp run \\\n  guard"))).toStrictEqual([]);
  });

  it("leaves the blank lines and the comments around a call alone", () => {
    expect(problemsFor(stepRunningBlock("# explain\n\nvp run guard"))).toStrictEqual([]);
  });

  it("leaves a step that declares no script alone", () => {
    expect(problemsFor("jobs:\n  build:\n    steps:\n      - run:\n")).toStrictEqual([]);
  });

  it("names the line the script was declared on", () => {
    expect(problemsFor(stepRunning("vp run build && vp run test"))[0]?.line).toBe(4);
  });
});
