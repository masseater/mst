import { describe, expect, test } from "vite-plus/test";

import { matchesAnchoredGlobPath, matchesGlobPath } from "./glob-path-match.ts";

const REPOSITORY_ROOT = "/repo";

describe("matchesGlobPath", () => {
  describe("an unanchored pattern naming segments that sit deeper in the path", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "index.ts"],
        pattern: "src/index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("matches wherever it sits in the path", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a pattern of one segment", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "index.ts"],
        pattern: "index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("matches the name at the end of the path", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a double star written around a segment", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "a", "b", "dist", "out.js"],
        pattern: "**/dist/**",
        cwd: REPOSITORY_ROOT,
      }));

    it("stands for any number of segments", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a double star written where the path ends", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "dist"],
        pattern: "dist/**",
        cwd: REPOSITORY_ROOT,
      }));

    it("stands for no segment at all", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a star written inside a segment of the pattern", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "reader.test.ts"],
        pattern: "**/*.test.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("stands for any run of characters inside one segment", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a star standing in front of a run of characters the segment does not carry", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "reader.ts"],
        pattern: "**/*.test.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("does not reach past the run of characters it stands for", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a pattern with more segments than the path", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src"],
        pattern: "src/index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("matches nothing", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a pattern anchored with a leading dot", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "index.ts"],
        pattern: "./src/index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("is resolved against the directory", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a pattern anchored at the root", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "index.ts"],
        pattern: "/repo/src/index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("is resolved against the root", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a pattern anchored above the directory", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "index.ts"],
        pattern: "../index.ts",
        cwd: "/repo/src",
      }));

    it("is resolved against the parent", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("an anchored pattern that resolves elsewhere", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({
        pathSegments: ["repo", "src", "index.ts"],
        pattern: "/other/src/index.ts",
        cwd: REPOSITORY_ROOT,
      }));

    it("matches nothing", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an empty path", () => {
    const it = test.extend("verdict", () =>
      matchesGlobPath({ pathSegments: [], pattern: "src", cwd: REPOSITORY_ROOT }));

    it("is matched by nothing", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});

describe("matchesAnchoredGlobPath", () => {
  describe("a pattern naming the segments the relative path starts with", () => {
    const it = test.extend("verdict", () =>
      matchesAnchoredGlobPath({ relativePath: "docs/lint/rule.md", pattern: "docs/lint/*.md" }));

    it("reads the path from its first segment", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a path carrying those segments deeper down", () => {
    const it = test.extend("verdict", () =>
      matchesAnchoredGlobPath({
        relativePath: "packages/alpha/docs/lint/rule.md",
        pattern: "docs/lint/*.md",
      }));

    it("is not reached by the anchored pattern", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an anchored pattern opening with a double star", () => {
    const it = test.extend("verdict", () =>
      matchesAnchoredGlobPath({
        relativePath: "packages/alpha/README.md",
        pattern: "**/README.md",
      }));

    it("still spans directories where it says so", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("the root pattern read against the root itself", () => {
    const it = test.extend("verdict", () =>
      matchesAnchoredGlobPath({ relativePath: ".", pattern: "." }));

    it("reaches it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("the root pattern read against a directory below the root", () => {
    const it = test.extend("verdict", () =>
      matchesAnchoredGlobPath({ relativePath: "packages/alpha", pattern: "." }));

    it("reaches nothing below the root", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
