import { describe, expect, test } from "vite-plus/test";

import { ignoreFilePatterns } from "./ignore-file-patterns.ts";

const it = test
  .extend("patternsBesideNoise", () => ignoreFilePatterns("# a comment\n\ndist\n\n   \n*.log\n"))
  .extend("patternsWithNegation", () => ignoreFilePatterns(".vscode/*\n!.vscode/settings.json\n"))
  .extend("patternsWithEscapedHash", () => ignoreFilePatterns("\\#not-a-comment\n"))
  .extend("patternsWithCarriageReturns", () => ignoreFilePatterns("dist  \r\nbuild\r\n"))
  .extend("patternsWithKeptTrailingSpace", () => ignoreFilePatterns("trailing\\ \n"));

describe("ignore-file-patterns", () => {
  it("blank lines and comments are dropped", ({ patternsBesideNoise }) => {
    expect(patternsBesideNoise).toStrictEqual(["dist", "*.log"]);
  });

  it("a negation keeps its leading bang", ({ patternsWithNegation }) => {
    expect(patternsWithNegation).toStrictEqual([".vscode/*", "!.vscode/settings.json"]);
  });

  it("an escaped hash is a pattern rather than a comment", ({ patternsWithEscapedHash }) => {
    expect(patternsWithEscapedHash).toStrictEqual(["\\#not-a-comment"]);
  });

  it("carriage returns and unescaped trailing spaces are stripped", ({
    patternsWithCarriageReturns,
  }) => {
    expect(patternsWithCarriageReturns).toStrictEqual(["dist", "build"]);
  });

  it("a trailing space kept by a backslash survives", ({ patternsWithKeptTrailingSpace }) => {
    expect(patternsWithKeptTrailingSpace).toStrictEqual(["trailing\\ "]);
  });
});
