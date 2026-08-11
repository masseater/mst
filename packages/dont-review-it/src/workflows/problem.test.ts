import { describe, expect, it } from "vite-plus/test";

import { formatWorkflowProblem } from "./problem.ts";

describe("formatWorkflowProblem", () => {
  it("puts the message after the file and the line it was found on", () => {
    expect(
      formatWorkflowProblem({
        file: ".github/workflows/ci.yml",
        line: 12,
        message: "Declare permissions.",
      }),
    ).toBe(".github/workflows/ci.yml:12 Declare permissions.");
  });
});
