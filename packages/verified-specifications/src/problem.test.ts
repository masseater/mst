import { describe, expect, test } from "vite-plus/test";

import { formatSpecificationProblem } from "./problem.ts";

describe("formatSpecificationProblem", () => {
  describe("a problem found on a line", () => {
    const it = test.extend("spelledProblem", () =>
      formatSpecificationProblem({
        file: "packages/repository-checks/specs/a.spec.ts",
        line: 3,
        message: "m",
      }));

    it("spells the file, the line and the message", ({ spelledProblem }) => {
      expect(spelledProblem).toBe("packages/repository-checks/specs/a.spec.ts:3 m");
    });
  });

  describe("a problem found on no line", () => {
    const it = test.extend("spelledProblem", () =>
      formatSpecificationProblem({
        file: "packages/repository-checks/SPECIFICATIONS.md",
        line: null,
        message: "m",
      }));

    it("leaves the line out", ({ spelledProblem }) => {
      expect(spelledProblem).toBe("packages/repository-checks/SPECIFICATIONS.md m");
    });
  });
});
