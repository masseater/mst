import { segmentsOf } from "../path-segments.ts";
import { toPosixPath } from "../posix-path.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES } from "../spec-syntax/spec-files.ts";

import type { LiteralNode } from "../canonical-values/literal-position.ts";

const PATTERN_ESCAPES = /\\/gu;

const PATTERN_ANCHORS = /^\^|\$$/gu;

const spelledPatternOf = (pattern: string): string =>
  pattern.replace(PATTERN_ESCAPES, "").replace(PATTERN_ANCHORS, "");

export const spelledPathIn = (node: LiteralNode): string | null => {
  if ("regex" in node) return spelledPatternOf(node.regex.pattern);
  return typeof node.value === "string" ? node.value : null;
};

const LEADING_HERE = /^\.\//u;

const TRAILING_SEPARATORS = /\/+$/u;

const writtenOutPath = (spelled: string): string =>
  toPosixPath(spelled).replace(LEADING_HERE, "").replace(TRAILING_SEPARATORS, "");

const PATTERN_CHARACTERS = /[*?+()[\]{}|]/u;

const LEAST_WRITTEN_OUT_SEGMENTS = 2;

export const namesAuthoredSpec = ({
  spelled,
  specPaths,
}: {
  readonly spelled: string;
  readonly specPaths: readonly string[];
}): boolean => {
  const written = writtenOutPath(spelled);
  if (written === "" || PATTERN_CHARACTERS.test(written)) return false;

  const namesSpecFile = DEFAULT_SPEC_FILE_SUFFIXES.some((suffix) => written.endsWith(suffix));
  const segments = segmentsOf({ path: written, separator: "/" });
  if (!namesSpecFile && segments.length < LEAST_WRITTEN_OUT_SEGMENTS) return false;

  const held = `/${written}`;
  return specPaths.some((specPath) => {
    const path = `/${specPath}`;
    return path.endsWith(held) || path.includes(`${held}/`);
  });
};
