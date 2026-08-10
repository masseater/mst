import { describe, expect, it } from "vite-plus/test";

import { runChecks } from "./run-checks.ts";

describe("runChecks", () => {
  it("runs every registered check in definition order", () => {
    const comparison = {
      repositoryRoot: "/repository",
      baseRevision: "base",
      headRevision: "head",
      files: [],
    };

    const problems = runChecks({
      comparison,
      checks: [
        {
          id: "first-check",
          run: () => [{ file: "z.ts", line: 2, message: "first result" }],
        },
        {
          id: "second-check",
          run: () => [{ file: "a.ts", line: 1, message: "second result" }],
        },
      ],
    });

    expect(problems).toStrictEqual([
      { checkId: "first-check", file: "z.ts", line: 2, message: "first result" },
      { checkId: "second-check", file: "a.ts", line: 1, message: "second result" },
    ]);
  });
});
