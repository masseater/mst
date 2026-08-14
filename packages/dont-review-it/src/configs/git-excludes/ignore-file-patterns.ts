const CARRIAGE_RETURN_SUFFIX = /\r$/u;

const UNESCAPED_TRAILING_SPACES = /(?<!\\)\s+$/u;

const withoutInsignificantWhitespace = (line: string): string =>
  line.replace(CARRIAGE_RETURN_SUFFIX, "").replace(UNESCAPED_TRAILING_SPACES, "");

const COMMENT_PREFIX = "#";

const isPattern = (line: string): boolean => line !== "" && !line.startsWith(COMMENT_PREFIX);

export const ignoreFilePatterns = (fileText: string): readonly string[] =>
  fileText.split("\n").map(withoutInsignificantWhitespace).filter(isPattern);
