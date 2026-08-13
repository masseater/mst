import { describe, expect, test } from "vite-plus/test";

import { buildValueDeclarationIndex, duplicateValueReportsIn } from "./declaration-index.ts";

import type { ValueDeclaration } from "./declarations.ts";

const AUTHORITY_PATH = "packages/one/src/read.ts";

const COPY_PATH = "packages/two/src/read.ts";

const EXPORTED_SEED: ValueDeclaration = {
  name: "seed",
  line: 3,
  exported: true,
  fingerprint: "one",
};

describe("duplicateValueReportsIn", () => {
  describe("a copy standing in another file", () => {
    const it = test.extend("sitesReportedForACopyInAnotherFile", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
          { relativePath: COPY_PATH, declarations: [{ ...EXPORTED_SEED, line: 8 }] },
        ]),
        relativePath: COPY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("reports a declaration another file spells with the same name and body", ({
      sitesReportedForACopyInAnotherFile,
    }) => {
      expect(sitesReportedForACopyInAnotherFile).toStrictEqual(["seed:8"]);
    });
  });

  describe("a copy standing twice in one file", () => {
    const it = test.extend("sitesReportedForACopyInOneFile", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          {
            relativePath: AUTHORITY_PATH,
            declarations: [EXPORTED_SEED, { ...EXPORTED_SEED, line: 9 }],
          },
        ]),
        relativePath: AUTHORITY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("reports a declaration standing twice in one file", ({ sitesReportedForACopyInOneFile }) => {
      expect(sitesReportedForACopyInOneFile).toStrictEqual(["seed:3", "seed:9"]);
    });
  });

  describe("two declarations neither of which is exported", () => {
    const it = test.extend("sitesReportedForTwoLocalDeclarations", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          {
            relativePath: AUTHORITY_PATH,
            declarations: [{ ...EXPORTED_SEED, exported: false }],
          },
          {
            relativePath: COPY_PATH,
            declarations: [{ ...EXPORTED_SEED, exported: false, line: 8 }],
          },
        ]),
        relativePath: COPY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("leaves a pair alone when neither of the two is exported", ({
      sitesReportedForTwoLocalDeclarations,
    }) => {
      expect(sitesReportedForTwoLocalDeclarations).toStrictEqual([]);
    });
  });

  describe("a local declaration standing against an exported one", () => {
    const it = test.extend("sitesReportedForALocalAgainstAnExportedOne", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
          {
            relativePath: COPY_PATH,
            declarations: [{ ...EXPORTED_SEED, exported: false, line: 8 }],
          },
        ]),
        relativePath: COPY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("reports a local declaration that stands against an exported one", ({
      sitesReportedForALocalAgainstAnExportedOne,
    }) => {
      expect(sitesReportedForALocalAgainstAnExportedOne).toStrictEqual(["seed:8"]);
    });
  });

  describe("two declarations whose bodies are spelled differently", () => {
    const it = test.extend("sitesReportedForBodiesSpelledDifferently", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
          {
            relativePath: COPY_PATH,
            declarations: [{ ...EXPORTED_SEED, fingerprint: "two", line: 8 }],
          },
        ]),
        relativePath: COPY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("leaves a pair alone when the two bodies are spelled differently", ({
      sitesReportedForBodiesSpelledDifferently,
    }) => {
      expect(sitesReportedForBodiesSpelledDifferently).toStrictEqual([]);
    });
  });

  describe("two declarations whose names are spelled differently", () => {
    const it = test.extend("sitesReportedForNamesSpelledDifferently", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
          { relativePath: COPY_PATH, declarations: [{ ...EXPORTED_SEED, name: "kept", line: 8 }] },
        ]),
        relativePath: COPY_PATH,
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("leaves a pair alone when the two names are spelled differently", ({
      sitesReportedForNamesSpelledDifferently,
    }) => {
      expect(sitesReportedForNamesSpelledDifferently).toStrictEqual([]);
    });
  });

  describe("an index listing no namesake for a declaration", () => {
    const it = test.extend("reportsForAnIndexListingNoNamesake", () =>
      duplicateValueReportsIn({
        index: {
          sitesByName: new Map(),
          sitesByPath: new Map([
            [AUTHORITY_PATH, [{ ...EXPORTED_SEED, relativePath: AUTHORITY_PATH }]],
          ]),
        },
        relativePath: AUTHORITY_PATH,
      }));

    it("leaves a declaration the index lists no namesake for alone", ({
      reportsForAnIndexListingNoNamesake,
    }) => {
      expect(reportsForAnIndexListingNoNamesake).toStrictEqual([]);
    });
  });

  describe("a file the index never saw", () => {
    const it = test.extend("sitesReportedForAFileTheIndexNeverSaw", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
        ]),
        relativePath: "packages/three/src/read.ts",
      }).map((report) => `${report.site.name}:${report.site.line}`));

    it("leaves a file the index never saw alone", ({ sitesReportedForAFileTheIndexNeverSaw }) => {
      expect(sitesReportedForAFileTheIndexNeverSaw).toStrictEqual([]);
    });
  });

  describe("a name standing at two places in the file it was copied into", () => {
    const it = test.extend("matchedSitesInReadingOrder", () =>
      duplicateValueReportsIn({
        index: buildValueDeclarationIndex([
          { relativePath: AUTHORITY_PATH, declarations: [EXPORTED_SEED] },
          {
            relativePath: COPY_PATH,
            declarations: [
              { ...EXPORTED_SEED, line: 12 },
              { ...EXPORTED_SEED, line: 8 },
            ],
          },
        ]),
        relativePath: AUTHORITY_PATH,
      }).flatMap((report) => report.matches.map((match) => `${match.relativePath}:${match.line}`)));

    it("hands back the other places the name stands, in reading order", ({
      matchedSitesInReadingOrder,
    }) => {
      expect(matchedSitesInReadingOrder).toStrictEqual([`${COPY_PATH}:8`, `${COPY_PATH}:12`]);
    });
  });
});
