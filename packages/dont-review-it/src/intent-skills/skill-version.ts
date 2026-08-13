import { attempt, isPlainObject } from "es-toolkit";
import { parse } from "yaml";

const FRONTMATTER_PATTERN = /^---\n(?<frontmatter>.*?)\n---/su;

const LIBRARY_VERSION_LINE_PATTERN = /^(?<indent>\s*)library_version:.*$/u;

const METADATA_KEY = "metadata";

const LIBRARY_VERSION_KEY = "library_version";

const declaredValueOf = (holder: unknown, named: string): unknown =>
  isPlainObject(holder) ? holder[named] : null;

export const libraryVersionOf = (source: string): string | null => {
  const frontmatterText = FRONTMATTER_PATTERN.exec(source)?.groups?.frontmatter;
  if (frontmatterText === undefined) return null;

  const [unparsed, frontmatter] = attempt<unknown, Error>(() => parse(frontmatterText));
  if (unparsed !== null) return null;

  const declared = declaredValueOf(declaredValueOf(frontmatter, METADATA_KEY), LIBRARY_VERSION_KEY);
  return typeof declared === "string" ? declared : null;
};

export const lineOfLibraryVersion = (source: string): number | null => {
  const found = source.split("\n").findIndex((line) => LIBRARY_VERSION_LINE_PATTERN.test(line));
  return found === -1 ? null : found + 1;
};

export const withLibraryVersion = ({
  source,
  version,
}: {
  readonly source: string;
  readonly version: string;
}): string =>
  source
    .split("\n")
    .map((line) => {
      const indent = LIBRARY_VERSION_LINE_PATTERN.exec(line)?.groups?.indent;
      return indent === undefined ? line : `${indent}${LIBRARY_VERSION_KEY}: "${version}"`;
    })
    .join("\n");
