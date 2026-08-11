import { describe, expect, it } from "vite-plus/test";

import { formatRepositoryProblem } from "./problem.ts";

describe("formatRepositoryProblem", () => {
  it("puts the message after the file and the line it was found on", () => {
    expect(
      formatRepositoryProblem({
        file: ".github/workflows/ci.yml",
        line: 12,
        message: "Declare permissions.",
      }),
    ).toBe(".github/workflows/ci.yml:12 Declare permissions.");
  });
});
