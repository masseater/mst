import { isScalar, parseDocument, Scalar } from "yaml";

const FRONTMATTER_OPENING_PATTERN = /^---\r?\n/u;

const FRONTMATTER_CLOSING_PATTERN = /^---(?:\r?\n|$)/mu;

const METADATA_KEY = "metadata";

const LIBRARY_VERSION_KEY = "library_version";

const LIBRARY_VERSION_PATH = [METADATA_KEY, LIBRARY_VERSION_KEY];

const frontmatterSegmentOf = (
  source: string,
): { readonly offset: number; readonly source: string } | null => {
  const opening = FRONTMATTER_OPENING_PATTERN.exec(source);
  if (opening === null) return null;

  const offset = opening[0].length;
  const remainder = source.slice(offset);
  const closing = FRONTMATTER_CLOSING_PATTERN.exec(remainder);
  if (closing === null) return null;

  return { offset, source: remainder.slice(0, closing.index) };
};

const libraryVersionDeclarationOf = (
  source: string,
): {
  readonly value: unknown;
  readonly type: Scalar.Type | null;
  readonly start: number;
  readonly end: number;
} | null => {
  const frontmatterSegment = frontmatterSegmentOf(source);
  if (frontmatterSegment === null) return null;

  const document = parseDocument(frontmatterSegment.source);
  if (document.errors.length > 0) return null;

  const declaration = document.getIn(LIBRARY_VERSION_PATH, true);
  if (!isScalar(declaration) || declaration.range === undefined || declaration.range === null)
    return null;

  return {
    value: declaration.value,
    type: declaration.type ?? null,
    start: frontmatterSegment.offset + declaration.range[0],
    end: frontmatterSegment.offset + declaration.range[1],
  };
};

export const libraryVersionOf = (source: string): string | null => {
  const declaration = libraryVersionDeclarationOf(source);
  return typeof declaration?.value === "string" ? declaration.value : null;
};

export const lineOfLibraryVersion = (source: string): number | null => {
  const declaration = libraryVersionDeclarationOf(source);
  return declaration === null ? null : source.slice(0, declaration.start).split("\n").length;
};

const renderedVersion = ({
  version,
  type,
}: {
  readonly version: string;
  readonly type: Scalar.Type | null;
}): string => {
  if (type === Scalar.PLAIN) return version;
  if (type === Scalar.QUOTE_SINGLE) return `'${version.replaceAll("'", "''")}'`;
  return JSON.stringify(version);
};

export const withLibraryVersion = ({
  source,
  version,
}: {
  readonly source: string;
  readonly version: string;
}): string => {
  const declaration = libraryVersionDeclarationOf(source);
  if (declaration === null) return source;

  return `${source.slice(0, declaration.start)}${renderedVersion({ version, type: declaration.type })}${source.slice(declaration.end)}`;
};
