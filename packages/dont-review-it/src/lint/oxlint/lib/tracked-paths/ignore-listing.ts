import { join } from "node:path";

import { ignoreFilePatterns } from "../../../../configs/git-excludes/ignore-file-patterns.ts";
import { readTextFile } from "../canonical-values/source-files.ts";

export const IGNORE_SETTINGS_FILE_NAME = ".gitignore";

const NEGATION_PREFIX = "!";

const LEADING_REACH = /^(?:\/|\*\*\/)+/u;

const TRAILING_REACH = /(?:\/\*\*|\/\*|\/)+$/u;

const spelledPlainly = (pattern: string): string =>
  pattern.replace(LEADING_REACH, "").replace(TRAILING_REACH, "");

export const ignoreListingAt = (workspaceRoot: string): ReadonlySet<string> => {
  const fileText = readTextFile(join(workspaceRoot, IGNORE_SETTINGS_FILE_NAME));
  if (fileText === null) return new Set();

  return new Set(
    ignoreFilePatterns(fileText)
      .filter((pattern) => !pattern.startsWith(NEGATION_PREFIX))
      .map(spelledPlainly),
  );
};

export const listedInIgnoreSettings = ({
  pattern,
  listing,
}: {
  readonly pattern: string;
  readonly listing: ReadonlySet<string>;
}): boolean => listing.has(spelledPlainly(pattern));
