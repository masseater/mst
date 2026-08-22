import { describe, expect, test } from "vite-plus/test";

import { declaresVersion } from "./changelog.ts";

describe("declaresVersion", () => {
  describe("a heading naming the version", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "# Title\n\n## 0.1.0\n\n- a change\n", version: "0.1.0" }));

    it("is found", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(true);
    });
  });

  describe("a heading that carries a date after the version", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "## 0.1.0 - 2026-08-13\n", version: "0.1.0" }));

    it("does not count as the exact version heading", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("a heading for another version", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "## 0.0.9\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("a version that only prefixes the heading", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "## 0.1.00\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("a heading at another depth", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "### 0.1.0\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written outside a heading", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "released 0.1.0 today\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written as a heading inside a fenced code block", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({
        source: "```markdown\n## 0.1.0\n```\n",
        version: "0.1.0",
      }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written inside an indented code block", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "    ## 0.1.0\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written as a heading inside frontmatter", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "---\n## 0.1.0\n---\n", version: "0.1.0" }));

    it("does not count", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written as a heading inside a block quote", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "> ## 0.1.0\n", version: "0.1.0" }));

    it("does not count as a top-level heading", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });

  describe("the version written as a level-two setext heading", () => {
    const it = test.extend("versionIsDeclared", () =>
      declaresVersion({ source: "0.1.0\n-----\n", version: "0.1.0" }));

    it("does not count as an ATX heading", ({ versionIsDeclared }) => {
      expect(versionIsDeclared).toBe(false);
    });
  });
});
