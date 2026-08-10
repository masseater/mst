import { gitExcludePatterns } from "./git-excludes/git-exclude-patterns.ts";
import { oxlint } from "./oxlint.ts";

import type { OxlintConfig } from "oxlint";

export const defineLintConfig = (config: OxlintConfig): OxlintConfig => ({
  ...config,
  extends: [...(config.extends ?? []), oxlint],
  ignorePatterns: [...gitExcludePatterns(), ...(config.ignorePatterns ?? [])],
});
