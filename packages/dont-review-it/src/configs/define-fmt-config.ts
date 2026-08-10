import { gitExcludePatterns } from "./git-excludes/git-exclude-patterns.ts";

export type FmtConfig = {
  readonly ignorePatterns?: readonly string[];
};

export const defineFmtConfig = <Config extends FmtConfig>(
  config: Config,
): Config & { ignorePatterns: string[] } => ({
  ...config,
  ignorePatterns: [...gitExcludePatterns(), ...(config.ignorePatterns ?? [])],
});
