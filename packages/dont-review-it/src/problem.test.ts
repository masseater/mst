import { describe, expect, test } from "vite-plus/test";

import { formatRepositoryProblem } from "./problem.ts";

describe("formatRepositoryProblem", () => {
  describe("a problem found on a line", () => {
    const it = test.extend("text", () =>
      formatRepositoryProblem({
        file: ".github/workflows/ci.yml",
        line: 12,
        message: "Declare permissions.",
      }));

    it("puts the message after the file and the line it was found on", ({ text }) => {
      expect(text).toBe(".github/workflows/ci.yml:12 Declare permissions.");
    });
  });

  describe("a problem found on no line", () => {
    const it = test.extend("text", () =>
      formatRepositoryProblem({
        file: "package.json",
        line: null,
        message: "Declare a name.",
      }));

    it("omits the line separator", ({ text }) => {
      expect(text).toBe("package.json Declare a name.");
    });
  });
});
