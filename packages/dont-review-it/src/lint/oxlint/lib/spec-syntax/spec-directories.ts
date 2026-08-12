import { configuredSuffixesFrom } from "../file-name-suffixes.ts";
import { segmentsOf } from "../path-segments.ts";

import type { Options } from "@oxlint/plugins";

const DEFAULT_SPEC_DIRECTORY_NAMES: readonly string[] = [
  "__specs__",
  "__tests__",
  "spec",
  "specs",
  "test",
  "tests",
];

const SPEC_DIRECTORY_NAMES_OPTION = "specDirectoryNames";

export const specDirectoryNamesFrom = (options: Readonly<Options>): ReadonlySet<string> =>
  new Set(
    configuredSuffixesFrom(options, {
      optionName: SPEC_DIRECTORY_NAMES_OPTION,
      carried: DEFAULT_SPEC_DIRECTORY_NAMES,
    }),
  );

export const specDirectoryOf = ({
  relativePath,
  names,
}: {
  readonly relativePath: string;
  readonly names: ReadonlySet<string>;
}): string | null => {
  const directorySegments = segmentsOf({ path: relativePath, separator: "/" }).slice(0, -1);
  const outermost = directorySegments.findIndex((segment) => names.has(segment));
  return outermost === -1 ? null : directorySegments.slice(0, outermost + 1).join("/");
};
