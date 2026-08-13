import { describe, expect, test } from "vite-plus/test";

import { coverageDeclarationsFrom, spelledNames } from "./coverage-declarations.ts";

const NAMED_CHECK = {
  name: "the analyser",
  coveredPaths: ["**/*.ts"],
  excludedPaths: ["**/*.d.ts"],
};

describe("coverageDeclarationsFrom", () => {
  describe("options that carry nothing", () => {
    const it = test.extend("declarationsReadFromNoOptions", () => coverageDeclarationsFrom([]));

    it("declares nothing", ({ declarationsReadFromNoOptions }) => {
      expect(declarationsReadFromNoOptions).toStrictEqual({
        checks: [],
        tables: [],
        uncheckedDeclarations: [],
        scopes: [],
      });
    });
  });

  describe("a field that is not a list", () => {
    const it = test.extend("checksReadFromAnUnlistedField", () =>
      coverageDeclarationsFrom([{ declaredChecks: "the analyser" }]));

    it("declares nothing", ({ checksReadFromAnUnlistedField }) => {
      expect(checksReadFromAnUnlistedField).toStrictEqual({
        checks: [],
        tables: [],
        uncheckedDeclarations: [],
        scopes: [],
      });
    });
  });

  describe("a named check", () => {
    const it = test.extend("checksReadFromANamedCheck", () =>
      coverageDeclarationsFrom([{ declaredChecks: [NAMED_CHECK] }]));

    it("keeps the paths it opens and the paths it leaves out", ({ checksReadFromANamedCheck }) => {
      expect(checksReadFromANamedCheck).toStrictEqual({
        checks: [NAMED_CHECK],
        tables: [],
        uncheckedDeclarations: [],
        scopes: [],
      });
    });
  });

  describe("checks whose names and paths are not written out", () => {
    const it = test.extend("checksReadFromUnspelledRows", () =>
      coverageDeclarationsFrom([
        {
          declaredChecks: [
            { coveredPaths: ["**/*.ts"] },
            { name: "   ", coveredPaths: ["**/*.ts"] },
            { name: "the type check", coveredPaths: [17, "**/*.ts"] },
          ],
        },
      ]));

    it("drops a check without a name, and a path that is not written out", ({
      checksReadFromUnspelledRows,
    }) => {
      expect(checksReadFromUnspelledRows).toStrictEqual({
        checks: [{ name: "the type check", coveredPaths: ["**/*.ts"], excludedPaths: [] }],
        tables: [],
        uncheckedDeclarations: [],
        scopes: [],
      });
    });
  });

  describe("a complete registry", () => {
    const it = test.extend("tablesReadFromACompleteRegistry", () =>
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
      ]));

    it("keeps its rows, its allowances, and the receivers they record", ({
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
  });

  describe("registries that leave out a consumer or a reason", () => {
    const it = test.extend("tablesReadFromIncompleteRegistries", () =>
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
      ]));

    it("drops a registry without a consumer, and a row without a reason", ({
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
  });

  describe("declarations of paths no check reads", () => {
    const it = test.extend("uncheckedDeclarationsReadFromMixedRows", () =>
      coverageDeclarationsFrom([
        {
          uncheckedDeclarations: [
            { pattern: "**/*.md", reason: "the guide is read by people" },
            { pattern: "**/*.txt" },
          ],
        },
      ]));

    it("keeps the pattern and the reason of the one that carries both", ({
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
  });

  describe("scope registrations written with and without paths", () => {
    const it = test.extend("scopesReadFromMixedRegistrations", () =>
      coverageDeclarationsFrom([
        {
          scopeRegistrations: [
            { registeredPaths: ["tools/**"] },
            { name: "the bootstrap zone" },
            { name: "the release zone", registeredPaths: ["tools/release/**"] },
          ],
        },
      ]));

    it("drops the one without a name, and registers none for the one without paths", ({
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
  });
});

describe("spelledNames", () => {
  describe("two names", () => {
    const it = test.extend("spellingOfTwoNames", () =>
      spelledNames(["the analyser", "the type check"]));

    it("spells them as a list the message can carry", ({ spellingOfTwoNames }) => {
      expect(spellingOfTwoNames).toBe("`the analyser`, `the type check`");
    });
  });
});
