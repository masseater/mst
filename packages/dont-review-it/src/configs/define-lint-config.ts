import type { OxlintConfig } from "oxlint";

import { gitExcludePatterns } from "./git-excludes/git-exclude-patterns.ts";
import { oxlint } from "./oxlint.ts";

export const defineLintConfig = (config: OxlintConfig): OxlintConfig => ({
  ...config,
  extends: [...(config.extends ?? []), oxlint],
  ignorePatterns: [...gitExcludePatterns(), ...(config.ignorePatterns ?? [])],
});
