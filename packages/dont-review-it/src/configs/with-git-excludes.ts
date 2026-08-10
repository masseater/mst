import { gitExcludePatterns } from "./git-excludes/git-exclude-patterns.ts";

import type { OxfmtConfig } from "oxfmt";
import type { OxlintConfig } from "oxlint";

/** @public */
export function withGitExcludes(config: OxfmtConfig): OxfmtConfig;
export function withGitExcludes(config: OxlintConfig): OxlintConfig;
export function withGitExcludes(config: OxfmtConfig | OxlintConfig): OxfmtConfig | OxlintConfig {
  return {
    ...config,
    ignorePatterns: [...gitExcludePatterns(), ...(config.ignorePatterns ?? [])],
  };
}
