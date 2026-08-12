import { describe, expect, test } from "vite-plus/test";

import { formatSpecificationProblem } from "./problem.ts";

describe("formatSpecificationProblem", () => {
  test("spells the file, the line and the message", () => {
    expect(
      formatSpecificationProblem({
        file: "packages/repository-checks/specs/a.spec.ts",
        line: 3,
        message: "m",
      }),
    ).toBe("packages/repository-checks/specs/a.spec.ts:3 m");
  });

  test("leaves the line out when the problem has none", () => {
    expect(
      formatSpecificationProblem({
        file: "packages/repository-checks/SPECIFICATIONS.md",
        line: null,
        message: "m",
      }),
    ).toBe("packages/repository-checks/SPECIFICATIONS.md m");
  });
});
