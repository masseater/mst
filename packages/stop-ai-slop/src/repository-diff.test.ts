import { describe, expect, it } from "vite-plus/test";

import { parseRepositoryDiff } from "./repository-diff.ts";

describe("parseRepositoryDiff", () => {
  it("rejects a non-empty diff that produces no files", () => {
    expect(() => parseRepositoryDiff("not a git diff\n")).toThrow(
      "Unable to parse non-empty Git diff",
    );
  });
});
