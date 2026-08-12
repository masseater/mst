import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { unboundedHistoryFetches } from "./history-fetch-depth.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  unboundedHistoryFetches({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

const checkoutWith = (inputs: string) =>
  `jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n${inputs}`;

describe("unboundedHistoryFetches", () => {
  it("reports a checkout that asks for every commit", () => {
    expect(problemsFor(checkoutWith("          fetch-depth: 0\n"))[0]?.message).toContain(
      "must not ask for the whole history",
    );
  });

  it("reports the same request written as a string", () => {
    expect(problemsFor(checkoutWith(`          fetch-depth: "0"\n`)).length).toBe(1);
  });

  it("sends the reader to the API that answers the question instead", () => {
    expect(problemsFor(checkoutWith("          fetch-depth: 0\n"))[0]?.message).toContain(
      "GitHub API",
    );
  });

  it("points at the line the depth was written on", () => {
    expect(problemsFor(checkoutWith("          fetch-depth: 0\n"))[0]?.line).toBe(6);
  });

  it("leaves a bounded depth alone", () => {
    expect(problemsFor(checkoutWith("          fetch-depth: 2\n"))).toStrictEqual([]);
  });

  it("leaves a checkout that says nothing about the depth alone", () => {
    expect(problemsFor(checkoutWith("          ref: main\n"))).toStrictEqual([]);
  });

  it("leaves a step that passes no inputs alone", () => {
    expect(
      problemsFor("jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n"),
    ).toStrictEqual([]);
  });
});
