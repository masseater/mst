import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { unpinnedActionRefs } from "./pinned-action-ref.ts";

const config = defaultWorkflowChecksConfig;

const PINNED_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

const problemsFor = (source: string) =>
  unpinnedActionRefs({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

const stepUsing = (reference: string) =>
  `jobs:\n  build:\n    steps:\n      - uses: ${reference}\n`;

describe("unpinnedActionRefs", () => {
  it("reports a reference that ends in a tag", () => {
    expect(problemsFor(stepUsing("actions/checkout@v5"))[0]?.message).toContain(
      "must not end in a tag or a branch",
    );
  });

  it("reports a reference that ends in a branch", () => {
    expect(problemsFor(stepUsing("actions/checkout@main")).length).toBe(1);
  });

  it("reports a reference that names no ref at all", () => {
    expect(problemsFor(stepUsing("actions/checkout")).length).toBe(1);
  });

  it("reports a shortened commit SHA", () => {
    expect(problemsFor(stepUsing(`actions/checkout@${PINNED_SHA.slice(0, 7)}`)).length).toBe(1);
  });

  it("names the reference it wants replaced", () => {
    expect(problemsFor(stepUsing("actions/checkout@v5"))[0]?.message).toContain(
      "actions/checkout@v5",
    );
  });

  it("reports a pinned reference that says nothing about the version it pins", () => {
    expect(problemsFor(stepUsing(`actions/checkout@${PINNED_SHA}`))[0]?.message).toContain(
      "must not stand without the version it pins",
    );
  });

  it("leaves a pinned reference that carries the version beside it alone", () => {
    expect(problemsFor(stepUsing(`actions/checkout@${PINNED_SHA} # v5`))).toStrictEqual([]);
  });

  it("leaves a reference to an action of this repository alone", () => {
    expect(problemsFor(stepUsing("./.github/actions/setup"))).toStrictEqual([]);
  });

  it("leaves a reference to a container image alone", () => {
    expect(problemsFor(stepUsing("docker://alpine:3.20"))).toStrictEqual([]);
  });

  it("reports the reusable workflow a job calls by tag", () => {
    expect(
      problemsFor("jobs:\n  build:\n    uses: masseater/mst/.github/workflows/guard.yml@v1\n")
        .length,
    ).toBe(1);
  });

  it("leaves a step whose reference is written without a value alone", () => {
    expect(problemsFor("jobs:\n  build:\n    steps:\n      - uses:\n")).toStrictEqual([]);
  });

  it("leaves a step that declares no reference alone", () => {
    expect(problemsFor("jobs:\n  build:\n    steps:\n      - run: vp run guard\n")).toStrictEqual(
      [],
    );
  });
});
