import {
  gitIgnoredRepositoryPaths,
  gitIgnorePatternForLiteralPath,
} from "../lint/oxlint/lib/git-ignored-source.ts";

import type { OxfmtConfig } from "oxfmt";
import type { OxlintConfig } from "oxlint";

export function withGitExcludes(config: OxfmtConfig): OxfmtConfig;
export function withGitExcludes(config: OxlintConfig): OxlintConfig;
export function withGitExcludes(config: OxfmtConfig | OxlintConfig): OxfmtConfig | OxlintConfig {
  const ignoredPatterns = [...gitIgnoredRepositoryPaths(process.cwd())].flatMap(
    (repositoryPath) => {
      const pattern = gitIgnorePatternForLiteralPath(repositoryPath);
      return pattern === null ? [] : [pattern];
    },
  );
  return {
    ...config,
    ignorePatterns: [...ignoredPatterns, ...(config.ignorePatterns ?? [])],
  };
}
