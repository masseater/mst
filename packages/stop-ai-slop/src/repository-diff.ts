import { zip } from "es-toolkit";
import parseGitDiff, { type AnyFileChange } from "parse-git-diff";

type InventoryFile =
  | Readonly<{ kind: "added"; beforePath: null; afterPath: string }>
  | Readonly<{ kind: "deleted"; beforePath: string; afterPath: null }>
  | Readonly<{ kind: "changed"; beforePath: string; afterPath: string }>
  | Readonly<{ kind: "renamed"; beforePath: string; afterPath: string }>
  | Readonly<{ kind: "typeChanged"; beforePath: string; afterPath: string }>;

const captureAt = (match: RegExpMatchArray, index: number): string => {
  const capture = match[index];
  if (capture === undefined || capture.length === 0) {
    throw new Error("Invalid NUL-delimited Git diff metadata");
  }
  return capture;
};

const inventoryFileFor = (match: RegExpMatchArray): InventoryFile => {
  if (match[3] !== undefined) {
    return {
      kind: "renamed",
      beforePath: captureAt(match, 4),
      afterPath: captureAt(match, 5),
    };
  }

  const path = captureAt(match, 2);
  switch (captureAt(match, 1)) {
    case "A":
      return { kind: "added", beforePath: null, afterPath: path };
    case "D":
      return { kind: "deleted", beforePath: path, afterPath: null };
    case "M":
      return { kind: "changed", beforePath: path, afterPath: path };
    case "T":
      return { kind: "typeChanged", beforePath: path, afterPath: path };
    default:
      throw new Error("Unsupported Git diff status");
  }
};

const nulCharacter = String.fromCodePoint(0);
const inventoryRecordPattern = new RegExp(
  `(?:([^${nulCharacter}])${nulCharacter}([^${nulCharacter}]*)${nulCharacter}|R(100|0\\d{2})${nulCharacter}([^${nulCharacter}]*)${nulCharacter}([^${nulCharacter}]*)${nulCharacter})`,
  "guy",
);

const parseDiffInventory = (produced: string): readonly InventoryFile[] => {
  const matches = Array.from(produced.matchAll(inventoryRecordPattern));
  const parsedLength = matches.reduce((counted, matched) => counted + matched[0].length, 0);
  if (parsedLength !== produced.length) {
    throw new Error("Invalid NUL-delimited Git diff metadata");
  }
  return matches.map(inventoryFileFor);
};

const parsedTypeFor = (
  nodeKind: Exclude<InventoryFile, { kind: "typeChanged" }>["kind"],
): AnyFileChange["type"] => {
  switch (nodeKind) {
    case "added":
      return "AddedFile";
    case "deleted":
      return "DeletedFile";
    case "changed":
      return "ChangedFile";
    case "renamed":
      return "RenamedFile";
  }
};

const patchExpectationsFor = (
  inventoryFile: InventoryFile,
): readonly Readonly<{
  inventoryFile: InventoryFile;
  expectedType: AnyFileChange["type"];
  producesChange: boolean;
}>[] =>
  inventoryFile.kind === "typeChanged"
    ? [
        { inventoryFile, expectedType: "DeletedFile", producesChange: false },
        { inventoryFile, expectedType: "AddedFile", producesChange: true },
      ]
    : [
        {
          inventoryFile,
          expectedType: parsedTypeFor(inventoryFile.kind),
          producesChange: true,
        },
      ];

export type RepositoryChange =
  | Readonly<{
      kind: "added";
      beforePath: null;
      afterPath: string;
      addedLines: readonly number[];
    }>
  | Readonly<{
      kind: "deleted";
      beforePath: string;
      afterPath: null;
      addedLines: readonly number[];
    }>
  | Readonly<{
      kind: "changed";
      beforePath: string;
      afterPath: string;
      addedLines: readonly number[];
    }>
  | Readonly<{
      kind: "renamed";
      beforePath: string;
      afterPath: string;
      addedLines: readonly number[];
    }>;

const addedLinesIn = (file: AnyFileChange): readonly number[] =>
  file.chunks.flatMap((writtenChunk) =>
    "changes" in writtenChunk
      ? writtenChunk.changes.flatMap((change) =>
          change.type === "AddedLine" ? [change.lineAfter] : [],
        )
      : [],
  );

const repositoryChangeFor = ({
  inventoryFile,
  parsedFile,
}: Readonly<{
  inventoryFile: InventoryFile;
  parsedFile: AnyFileChange;
}>): RepositoryChange => {
  const addedLines = addedLinesIn(parsedFile);
  switch (inventoryFile.kind) {
    case "added":
      return { ...inventoryFile, addedLines };
    case "deleted":
      return { ...inventoryFile, addedLines };
    case "changed":
      return { ...inventoryFile, addedLines };
    case "renamed":
      return { ...inventoryFile, addedLines };
    case "typeChanged":
      return {
        kind: "changed",
        beforePath: inventoryFile.beforePath,
        afterPath: inventoryFile.afterPath,
        addedLines,
      };
  }
};

export const parseRepositoryChanges = ({
  inventoryOutput,
  diff,
}: Readonly<{
  inventoryOutput: string;
  diff: string;
}>): readonly RepositoryChange[] => {
  const inventory = parseDiffInventory(inventoryOutput);
  const parsedNode = parseGitDiff(diff);
  if (diff.trim().length > 0 && parsedNode.files.length === 0) {
    throw new Error("Unable to parse non-empty Git diff");
  }

  const patchExpectations = inventory.flatMap(patchExpectationsFor);
  if (patchExpectations.length !== parsedNode.files.length) {
    throw new Error(
      `Git diff metadata and patch file counts disagree: ${patchExpectations.length} != ${parsedNode.files.length}`,
    );
  }

  return zip(patchExpectations, parsedNode.files).flatMap(([expectation, parsedFile]) => {
    if (parsedFile.type !== expectation.expectedType) {
      throw new Error(
        `Git diff metadata and patch disagree: ${expectation.expectedType} != ${parsedFile.type}`,
      );
    }
    return expectation.producesChange
      ? [repositoryChangeFor({ inventoryFile: expectation.inventoryFile, parsedFile })]
      : [];
  });
};
