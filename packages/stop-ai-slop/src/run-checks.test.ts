import { describe, expect, test } from "vite-plus/test";

import { runChecks } from "./run-checks.ts";

describe("runChecks", () => {
  const it = test.extend("problemsFromTwoRegisteredChecks", () =>
    runChecks({
      comparison: {
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [],
      },
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
    }));

  it("runs every registered check in definition order", ({ problemsFromTwoRegisteredChecks }) => {
    expect(problemsFromTwoRegisteredChecks).toStrictEqual([
      { checkId: "first-check", file: "z.ts", line: 2, message: "first result" },
      { checkId: "second-check", file: "a.ts", line: 1, message: "second result" },
    ]);
  });
});
