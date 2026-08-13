const VERSION_HEADING_PREFIX = "## ";

const WHITESPACE_PATTERN = /\s+/u;

export const declaresVersion = ({
  source,
  version,
}: {
  readonly source: string;
  readonly version: string;
}): boolean =>
  source
    .split("\n")
    .some(
      (line) =>
        line.startsWith(VERSION_HEADING_PREFIX) &&
        line.slice(VERSION_HEADING_PREFIX.length).trim().split(WHITESPACE_PATTERN)[0] === version,
    );
