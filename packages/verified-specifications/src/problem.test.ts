import { describe, expect, test } from "vite-plus/test";

import { formatSpecificationProblem } from "./problem.ts";

describe("formatSpecificationProblem", () => {
  describe("a problem found on a line", () => {
    const it = test.extend("text", () =>
      formatSpecificationProblem({
        file: "packages/repository-checks/specs/a.spec.ts",
        line: 3,
        message: "m",
      }));

    it("spells the file, the line and the message", ({ text }) => {
      expect(text).toBe("packages/repository-checks/specs/a.spec.ts:3 m");
    });
  });

  describe("a problem found on no line", () => {
    const it = test.extend("text", () =>
      formatSpecificationProblem({
        file: "packages/repository-checks/SPECIFICATIONS.md",
        line: null,
        message: "m",
      }));

    it("leaves the line out", ({ text }) => {
      expect(text).toBe("packages/repository-checks/SPECIFICATIONS.md m");
    });
  });
});
