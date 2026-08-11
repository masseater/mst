import { describe, expect, test } from "vite-plus/test";

import { coverageDeclarationsFrom, spelledNames } from "./coverage-declarations.ts";

const NAMED_CHECK = {
  name: "the analyser",
  coveredPaths: ["**/*.ts"],
  excludedPaths: ["**/*.d.ts"],
};

describe("coverage-declarations", () => {
  test("options that carry nothing declare nothing", () => {
    expect(coverageDeclarationsFrom([])).toStrictEqual({
      checks: [],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  test("a field that is not a list declares nothing", () => {
    expect(coverageDeclarationsFrom([{ declaredChecks: "the analyser" }]).checks).toStrictEqual([]);
  });

  test("a check keeps the paths it opens and the paths it leaves out", () => {
    expect(coverageDeclarationsFrom([{ declaredChecks: [NAMED_CHECK] }]).checks).toStrictEqual([
      NAMED_CHECK,
    ]);
  });

  test("a check without a name, and a path that is not written out, are dropped", () => {
    const declared = coverageDeclarationsFrom([
      {
        declaredChecks: [
          { coveredPaths: ["**/*.ts"] },
          { name: "   ", coveredPaths: ["**/*.ts"] },
          { name: "the type check", coveredPaths: [17, "**/*.ts"] },
        ],
      },
    ]);
    expect(declared.checks).toStrictEqual([
      { name: "the type check", coveredPaths: ["**/*.ts"], excludedPaths: [] },
    ]);
  });

  test("a registry keeps its rows, its allowances, and the receivers they record", () => {
    const declared = coverageDeclarationsFrom([
      {
        registries: [
          {
            name: "the forbidden files",
            consumedBy: "the analyser",
            rows: [{ pattern: "**/*.js", reason: "sources are authored in TypeScript" }],
            allowances: [
              {
                pattern: "tools/shim.js",
                reason: "the shim ships as JavaScript",
                receivers: ["the type check"],
              },
            ],
          },
        ],
      },
    ]);
    expect(declared.tables).toStrictEqual([
      {
        name: "the forbidden files",
        consumedBy: "the analyser",
        rows: [
          {
            pattern: "**/*.js",
            reason: "sources are authored in TypeScript",
            receivers: [],
          },
        ],
        allowances: [
          {
            pattern: "tools/shim.js",
            reason: "the shim ships as JavaScript",
            receivers: ["the type check"],
          },
        ],
      },
    ]);
  });

  test("a registry without a consumer, and a row without a reason, are dropped", () => {
    const declared = coverageDeclarationsFrom([
      {
        registries: [
          { name: "the tracked paths", rows: [{ pattern: "**/*.env" }] },
          {
            name: "the required files",
            consumedBy: "the file scan",
            rows: [{ reason: "the entry is read outside the source" }],
          },
        ],
      },
    ]);
    expect(declared.tables).toStrictEqual([
      { name: "the required files", consumedBy: "the file scan", rows: [], allowances: [] },
    ]);
  });

  test("a declaration of paths no check reads keeps its pattern and its reason", () => {
    const declared = coverageDeclarationsFrom([
      {
        uncheckedDeclarations: [
          { pattern: "**/*.md", reason: "the guide is read by people" },
          { pattern: "**/*.txt" },
        ],
      },
    ]);
    expect(declared.uncheckedDeclarations).toStrictEqual([
      { pattern: "**/*.md", reason: "the guide is read by people", receivers: [] },
    ]);
  });

  test("a scope registration without a name is dropped, and one without paths registers none", () => {
    const declared = coverageDeclarationsFrom([
      {
        scopeRegistrations: [
          { registeredPaths: ["tools/**"] },
          { name: "the bootstrap zone" },
          { name: "the release zone", registeredPaths: ["tools/release/**"] },
        ],
      },
    ]);
    expect(declared.scopes).toStrictEqual([
      { name: "the bootstrap zone", registeredPaths: [] },
      { name: "the release zone", registeredPaths: ["tools/release/**"] },
    ]);
  });

  test("names are spelled as a list the message can carry", () => {
    expect(spelledNames(["the analyser", "the type check"])).toBe(
      "`the analyser`, `the type check`",
    );
  });
});
