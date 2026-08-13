import { describe, expect, test } from "vite-plus/test";

import { ignoreFilePatterns } from "./ignore-file-patterns.ts";

describe("ignoreFilePatterns", () => {
  describe("text carrying a comment, a blank line and a line of spaces", () => {
    const it = test.extend("patterns", () =>
      ignoreFilePatterns("# a comment\n\ndist\n\n   \n*.log\n"));

    it("keeps only the lines that name a pattern", ({ patterns }) => {
      expect(patterns).toStrictEqual(["dist", "*.log"]);
    });
  });

  describe("a line taking back an earlier pattern", () => {
    const it = test.extend("patterns", () =>
      ignoreFilePatterns(".vscode/*\n!.vscode/settings.json\n"));

    it("leaves the leading bang on the negation", ({ patterns }) => {
      expect(patterns).toStrictEqual([".vscode/*", "!.vscode/settings.json"]);
    });
  });

  describe("a line opening with an escaped hash", () => {
    const it = test.extend("patterns", () => ignoreFilePatterns("\\#not-a-comment\n"));

    it("reads the line as a pattern rather than a comment", ({ patterns }) => {
      expect(patterns).toStrictEqual(["\\#not-a-comment"]);
    });
  });

  describe("lines ending in a carriage return and unescaped spaces", () => {
    const it = test.extend("patterns", () => ignoreFilePatterns("dist  \r\nbuild\r\n"));

    it("strips both from the end of every pattern", ({ patterns }) => {
      expect(patterns).toStrictEqual(["dist", "build"]);
    });
  });

  describe("a trailing space held by a backslash", () => {
    const it = test.extend("patterns", () => ignoreFilePatterns("trailing\\ \n"));

    it("keeps the space at the end of the pattern", ({ patterns }) => {
      expect(patterns).toStrictEqual(["trailing\\ "]);
    });
  });
});
