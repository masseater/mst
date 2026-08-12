export const CONTENT_OMISSIONS = ["deleted", "binary", "too-large", "submodule"] as const;

export type ContentOmission = (typeof CONTENT_OMISSIONS)[number];

export type ChangedFile = {
  readonly statusCode: string;
  readonly path: string;
  readonly previousPath: string | null;
  readonly content: string | null;
  readonly omissionReason: ContentOmission | null;
};

const isRename = (statusCode: string): boolean => /^R\d+$/.test(statusCode);

const parseRow = (row: string): ChangedFile | null => {
  const [statusCode, ...rest] = row.split("\t");
  if (statusCode === undefined || statusCode === "") return null;
  if (isRename(statusCode)) {
    return {
      statusCode,
      path: rest[1] ?? rest[0] ?? "",
      previousPath: rest[0] ?? "",
      content: null,
      omissionReason: null,
    };
  }
  return {
    statusCode,
    path: rest[0] ?? "",
    previousPath: null,
    content: null,
    omissionReason: null,
  };
};

export const parseNameStatus = (output: string): readonly ChangedFile[] =>
  output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((row) => {
      const file = parseRow(row);
      return file === null ? [] : [file];
    });

export const isDeletion = (statusCode: string): boolean => statusCode === "D";
