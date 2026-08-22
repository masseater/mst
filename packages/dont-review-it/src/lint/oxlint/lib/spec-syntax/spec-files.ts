import {
  configuredSuffixesFrom,
  longestMatchingSuffix,
  stemBefore,
} from "../file-name-suffixes.ts";

import type { Options } from "@oxlint/plugins";

export const DEFAULT_SPEC_FILE_SUFFIXES: readonly string[] = [".test.ts", ".test.tsx"];

const SPEC_FILE_SUFFIXES_OPTION = "specFileSuffixes";

export const specFileSuffixesFrom = (ruleOptions: Readonly<Options>): readonly string[] =>
  configuredSuffixesFrom(ruleOptions, {
    optionName: SPEC_FILE_SUFFIXES_OPTION,
    carried: DEFAULT_SPEC_FILE_SUFFIXES,
  });

export const isSpecFile = (filename: string, suffixes: readonly string[]): boolean =>
  longestMatchingSuffix(filename, suffixes) !== null;

export const specStemOf = (filename: string, suffixes: readonly string[]): string | null => {
  const suffix = longestMatchingSuffix(filename, suffixes);
  return suffix === null ? null : stemBefore(filename, suffix);
};
