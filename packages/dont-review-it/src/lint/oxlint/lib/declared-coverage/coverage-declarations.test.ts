import { describe, expect, test } from "vite-plus/test";

import { coverageDeclarationsFrom, spelledNames } from "./coverage-declarations.ts";

const NAMED_CHECK = {
  name: "the analyser",
  coveredPaths: ["**/*.ts"],
  excludedPaths: ["**/*.d.ts"],
};

const it = test
  .extend("declarationsReadFromNoOptions", () => coverageDeclarationsFrom([]))
  .extend("checksReadFromAnUnlistedField", () =>
    coverageDeclarationsFrom([{ declaredChecks: "the analyser" }]),
  )
  .extend("checksReadFromANamedCheck", () =>
    coverageDeclarationsFrom([{ declaredChecks: [NAMED_CHECK] }]),
  )
  .extend("checksReadFromUnspelledRows", () =>
    coverageDeclarationsFrom([
      {
        declaredChecks: [
          { coveredPaths: ["**/*.ts"] },
          { name: "   ", coveredPaths: ["**/*.ts"] },
          { name: "the type check", coveredPaths: [17, "**/*.ts"] },
        ],
      },
    ]),
  )
  .extend("tablesReadFromACompleteRegistry", () =>
    coverageDeclarationsFrom([
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
    ]),
  )
  .extend("tablesReadFromIncompleteRegistries", () =>
    coverageDeclarationsFrom([
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
    ]),
  )
  .extend("uncheckedDeclarationsReadFromMixedRows", () =>
    coverageDeclarationsFrom([
      {
        uncheckedDeclarations: [
          { pattern: "**/*.md", reason: "the guide is read by people" },
          { pattern: "**/*.txt" },
        ],
      },
    ]),
  )
  .extend("scopesReadFromMixedRegistrations", () =>
    coverageDeclarationsFrom([
      {
        scopeRegistrations: [
          { registeredPaths: ["tools/**"] },
          { name: "the bootstrap zone" },
          { name: "the release zone", registeredPaths: ["tools/release/**"] },
        ],
      },
    ]),
  )
  .extend("spellingOfTwoNames", () => spelledNames(["the analyser", "the type check"]));

describe("coverage-declarations", () => {
  it("options that carry nothing declare nothing", ({ declarationsReadFromNoOptions }) => {
    expect(declarationsReadFromNoOptions).toStrictEqual({
      checks: [],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a field that is not a list declares nothing", ({ checksReadFromAnUnlistedField }) => {
    expect(checksReadFromAnUnlistedField).toStrictEqual({
      checks: [],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a check keeps the paths it opens and the paths it leaves out", ({
    checksReadFromANamedCheck,
  }) => {
    expect(checksReadFromANamedCheck).toStrictEqual({
      checks: [NAMED_CHECK],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a check without a name, and a path that is not written out, are dropped", ({
    checksReadFromUnspelledRows,
  }) => {
    expect(checksReadFromUnspelledRows).toStrictEqual({
      checks: [{ name: "the type check", coveredPaths: ["**/*.ts"], excludedPaths: [] }],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a registry keeps its rows, its allowances, and the receivers they record", ({
    tablesReadFromACompleteRegistry,
  }) => {
    expect(tablesReadFromACompleteRegistry).toStrictEqual({
      checks: [],
      tables: [
        {
          name: "the forbidden files",
          consumedBy: "the analyser",
          rows: [
            { pattern: "**/*.js", reason: "sources are authored in TypeScript", receivers: [] },
          ],
          allowances: [
            {
              pattern: "tools/shim.js",
              reason: "the shim ships as JavaScript",
              receivers: ["the type check"],
            },
          ],
        },
      ],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a registry without a consumer, and a row without a reason, are dropped", ({
    tablesReadFromIncompleteRegistries,
  }) => {
    expect(tablesReadFromIncompleteRegistries).toStrictEqual({
      checks: [],
      tables: [
        { name: "the required files", consumedBy: "the file scan", rows: [], allowances: [] },
      ],
      uncheckedDeclarations: [],
      scopes: [],
    });
  });

  it("a declaration of paths no check reads keeps its pattern and its reason", ({
    uncheckedDeclarationsReadFromMixedRows,
  }) => {
    expect(uncheckedDeclarationsReadFromMixedRows).toStrictEqual({
      checks: [],
      tables: [],
      uncheckedDeclarations: [
        { pattern: "**/*.md", reason: "the guide is read by people", receivers: [] },
      ],
      scopes: [],
    });
  });

  it("a scope registration without a name is dropped, and one without paths registers none", ({
    scopesReadFromMixedRegistrations,
  }) => {
    expect(scopesReadFromMixedRegistrations).toStrictEqual({
      checks: [],
      tables: [],
      uncheckedDeclarations: [],
      scopes: [
        { name: "the bootstrap zone", registeredPaths: [] },
        { name: "the release zone", registeredPaths: ["tools/release/**"] },
      ],
    });
  });

  it("names are spelled as a list the message can carry", ({ spellingOfTwoNames }) => {
    expect(spellingOfTwoNames).toBe("`the analyser`, `the type check`");
  });
});
