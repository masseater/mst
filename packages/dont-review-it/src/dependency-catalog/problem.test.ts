import { describe, expect, it } from "vite-plus/test";

import { formatDependencyCatalogProblem } from "./problem.ts";

describe("formatDependencyCatalogProblem", () => {
  it("prints the file before the message", () => {
    expect(
      formatDependencyCatalogProblem({ file: "pnpm-workspace.yaml", message: "The catalog." }),
    ).toBe("pnpm-workspace.yaml The catalog.");
  });
});
