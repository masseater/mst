import { describe, expect, test } from "vite-plus/test";

import {
  gitIgnoredRepositoryPaths,
  gitIgnorePatternForLiteralPath,
} from "../lint/oxlint/lib/git-ignored-source.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

const REPOSITORY_EXCLUDES = [...gitIgnoredRepositoryPaths(process.cwd())].flatMap(
  (repositoryPath) => {
    const pattern = gitIgnorePatternForLiteralPath(repositoryPath);
    return pattern === null ? [] : [pattern];
  },
);

describe("withGitExcludes", () => {
  describe("an explicit lint configuration", () => {
    const it = test.extend("combinedConfig", () =>
      withGitExcludes({
        ignorePatterns: ["generated/**"],
        rules: { eqeqeq: "error" },
      }));

    it("prepends repository exclusions and preserves every setting", ({ combinedConfig }) => {
      expect(combinedConfig).toStrictEqual({
        ignorePatterns: [...REPOSITORY_EXCLUDES, "generated/**"],
        rules: { eqeqeq: "error" },
      });
    });
  });

  describe("a configuration without explicit exclusions", () => {
    const it = test.extend("combinedConfig", () => withGitExcludes({}));

    it("supplies the repository exclusions", ({ combinedConfig }) => {
      expect(combinedConfig).toStrictEqual({ ignorePatterns: REPOSITORY_EXCLUDES });
    });
  });
});
