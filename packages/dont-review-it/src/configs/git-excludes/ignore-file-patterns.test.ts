import { expect, test } from "vite-plus/test";

import { ignoreFilePatterns } from "./ignore-file-patterns.ts";

test("blank lines and comments are dropped", () => {
  expect(ignoreFilePatterns("# a comment\n\ndist\n\n   \n*.log\n")).toEqual(["dist", "*.log"]);
});

test("a negation keeps its leading bang", () => {
  expect(ignoreFilePatterns(".vscode/*\n!.vscode/settings.json\n")).toEqual([
    ".vscode/*",
    "!.vscode/settings.json",
  ]);
});

test("an escaped hash is a pattern rather than a comment", () => {
  expect(ignoreFilePatterns("\\#not-a-comment\n")).toEqual(["\\#not-a-comment"]);
});

test("carriage returns and unescaped trailing spaces are stripped", () => {
  expect(ignoreFilePatterns("dist  \r\nbuild\r\n")).toEqual(["dist", "build"]);
});

test("a trailing space kept by a backslash survives", () => {
  expect(ignoreFilePatterns("trailing\\ \n")).toEqual(["trailing\\ "]);
});
