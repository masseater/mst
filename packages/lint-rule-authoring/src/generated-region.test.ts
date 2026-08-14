import { describe, expect, test } from "vite-plus/test";

import { withRefreshedRegionIn } from "./generated-region.ts";

const BEGIN = "<!-- BEGIN GENERATED messages -->";

const END = "<!-- END GENERATED messages -->";

const REFRESHED = "the freshly rendered table";

describe("withRefreshedRegionIn", () => {
  describe("a source carrying the markers", () => {
    const it = test.extend("refreshed", () =>
      withRefreshedRegionIn({
        source: `# a rule\n\n${BEGIN}\n\nwhat stood here before\n\n${END}\n`,
        begin: BEGIN,
        end: END,
        content: REFRESHED,
      }));

    it("puts the rendered content between them and leaves the rest alone", ({ refreshed }) => {
      expect(refreshed).toBe(`# a rule\n\n${BEGIN}\n\n${REFRESHED}\n\n${END}\n`);
    });
  });

  describe("a source carrying no marker", () => {
    const it = test.extend("refreshed", () =>
      withRefreshedRegionIn({
        source: "# a rule\n\nwhat stood here before\n",
        begin: BEGIN,
        end: END,
        content: REFRESHED,
      }));

    it("hands the source back as it was, writing the content nowhere", ({ refreshed }) => {
      expect(refreshed).toBe("# a rule\n\nwhat stood here before\n");
    });
  });
});
