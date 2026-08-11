import { describe, expect, test } from "vite-plus/test";

import { matchesAnchoredGlobPath, matchesGlobPath } from "./glob-path-match.ts";

const REPOSITORY_ROOT = "/repo";

const matches = (pattern: string, pathSegments: readonly string[]): boolean =>
  matchesGlobPath({ pathSegments, pattern, cwd: REPOSITORY_ROOT });

describe("glob-path-match", () => {
  test("an unanchored pattern matches wherever it sits in the path", () => {
    expect(matches("src/index.ts", ["repo", "src", "index.ts"])).toBe(true);
    expect(matches("index.ts", ["repo", "src", "index.ts"])).toBe(true);
  });

  test("a double star stands for any number of segments, including none", () => {
    expect(matches("**/dist/**", ["repo", "a", "b", "dist", "out.js"])).toBe(true);
    expect(matches("dist/**", ["repo", "dist"])).toBe(true);
  });

  test("a star stands for any run of characters inside one segment", () => {
    expect(matches("**/*.test.ts", ["repo", "src", "reader.test.ts"])).toBe(true);
    expect(matches("**/*.test.ts", ["repo", "src", "reader.ts"])).toBe(false);
  });

  test("a pattern with more segments than the path matches nothing", () => {
    expect(matches("src/index.ts", ["repo", "src"])).toBe(false);
  });

  test("a pattern anchored to a directory is resolved against that directory", () => {
    expect(matches("./src/index.ts", ["repo", "src", "index.ts"])).toBe(true);
    expect(matches("/repo/src/index.ts", ["repo", "src", "index.ts"])).toBe(true);
    expect(
      matchesGlobPath({
        pathSegments: ["repo", "index.ts"],
        pattern: "../index.ts",
        cwd: "/repo/src",
      }),
    ).toBe(true);
  });

  test("an anchored pattern that resolves elsewhere matches nothing", () => {
    expect(matches("/other/src/index.ts", ["repo", "src", "index.ts"])).toBe(false);
  });

  test("an empty path is matched by nothing", () => {
    expect(matches("src", [])).toBe(false);
  });

  test("an anchored relative path is read from its first segment", () => {
    expect(
      matchesAnchoredGlobPath({ relativePath: "docs/lint/rule.md", pattern: "docs/lint/*.md" }),
    ).toBe(true);
    expect(
      matchesAnchoredGlobPath({
        relativePath: "packages/alpha/docs/lint/rule.md",
        pattern: "docs/lint/*.md",
      }),
    ).toBe(false);
  });

  test("an anchored pattern still spans directories where it says so", () => {
    expect(
      matchesAnchoredGlobPath({
        relativePath: "packages/alpha/README.md",
        pattern: "**/README.md",
      }),
    ).toBe(true);
    expect(matchesAnchoredGlobPath({ relativePath: ".", pattern: "." })).toBe(true);
    expect(matchesAnchoredGlobPath({ relativePath: "packages/alpha", pattern: "." })).toBe(false);
  });
});
