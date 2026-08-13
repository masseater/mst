import { describe, expect, test } from "vite-plus/test";

import { formatDependencyCatalogProblem } from "./problem.ts";

describe("formatDependencyCatalogProblem", () => {
  describe("a problem carrying a file and a message", () => {
    const it = test.extend("text", () =>
      formatDependencyCatalogProblem({
        file: "pnpm-workspace.yaml",
        line: null,
        message: "The catalog.",
      }));

    it("prints the file before the message", ({ text }) => {
      expect(text).toBe("pnpm-workspace.yaml The catalog.");
    });
  });
});
