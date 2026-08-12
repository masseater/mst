import { describe, expect, test } from "vite-plus/test";

import { gitExcludePatterns } from "./git-excludes/git-exclude-patterns.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

import type { OxlintConfig } from "oxlint";

describe("withGitExcludes", () => {
  test("it prepends repository exclusions and preserves explicit lint settings", () => {
    const configured: OxlintConfig = {
      ignorePatterns: ["generated/**"],
      rules: { eqeqeq: "error" },
    };

    const combined = withGitExcludes(configured);

    expect(combined).not.toBe(configured);
    expect(combined.ignorePatterns).toStrictEqual([...gitExcludePatterns(), "generated/**"]);
    expect(combined.rules).toBe(configured.rules);
  });

  test("it supplies repository exclusions when the caller declared none", () => {
    expect(withGitExcludes({}).ignorePatterns).toStrictEqual([...gitExcludePatterns()]);
  });
});
