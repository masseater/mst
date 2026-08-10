import { execFile } from "node:child_process";
import { extname } from "node:path";
import { promisify } from "node:util";

import parseGitDiff, { type AnyFileChange, type GitDiff } from "parse-git-diff";

export type CompareRevisionsOptions = Readonly<{
  repositoryRoot: string;
  baseRevision: string;
  headRevision: string;
}>;

type AddedComparisonFile = Readonly<{
  kind: "added";
  beforePath: null;
  afterPath: string;
  beforeSource: null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

type DeletedComparisonFile = Readonly<{
  kind: "deleted";
  beforePath: string;
  afterPath: null;
  beforeSource: string | null;
  afterSource: null;
  addedLines: readonly number[];
  firstAddedLine: null;
}>;

type ChangedComparisonFile = Readonly<{
  kind: "changed";
  beforePath: string;
  afterPath: string;
  beforeSource: string | null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

type RenamedComparisonFile = Readonly<{
  kind: "renamed";
  beforePath: string;
  afterPath: string;
  beforeSource: string | null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

export type ComparisonFile =
  | AddedComparisonFile
  | DeletedComparisonFile
  | ChangedComparisonFile
  | RenamedComparisonFile;

export type RepositoryComparison = Readonly<{
  repositoryRoot: string;
  baseRevision: string;
  headRevision: string;
  files: readonly ComparisonFile[];
}>;

const executeFile = promisify(execFile);

const runGitText = async (repositoryRoot: string, args: readonly string[]): Promise<string> => {
  const { stderr, stdout } = await executeFile("git", [...args], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024,
  });
  if (stderr.length > 0) {
    throw new Error(
      `Git command wrote to stderr: ${new TextDecoder("utf-8", { fatal: true }).decode(stderr)}`,
    );
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(stdout);
};

const resolveCommit = async (repositoryRoot: string, revision: string): Promise<string> =>
  (
    await runGitText(repositoryRoot, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${revision}^{commit}`,
    ])
  ).trim();

const sourceExtensions = [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"];

const readSource = async ({
  repositoryRoot,
  revision,
  path,
}: Readonly<{
  repositoryRoot: string;
  revision: string;
  path: string;
}>): Promise<string | null> => {
  if (!sourceExtensions.includes(extname(path).toLowerCase())) {
    return null;
  }

  const { stdout } = await executeFile("git", ["cat-file", "blob", `${revision}:${path}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024,
  });

  return stdout.includes(0) ? null : stdout.toString("utf8");
};

const addedLinesIn = (file: AnyFileChange): readonly number[] =>
  file.chunks.flatMap((chunk) =>
    "changes" in chunk
      ? chunk.changes.flatMap((change) => (change.type === "AddedLine" ? [change.lineAfter] : []))
      : [],
  );

export const parseRepositoryDiff = (diff: string): GitDiff => {
  const parsed = parseGitDiff(diff);
  if (diff.trim().length > 0 && parsed.files.length === 0) {
    throw new Error("Unable to parse non-empty Git diff");
  }

  return parsed;
};

type ComparisonContext = Readonly<{
  repositoryRoot: string;
  baseCommit: string;
  headCommit: string;
}>;

type AddedInventoryFile = Readonly<{
  kind: "added";
  beforePath: null;
  afterPath: string;
}>;

type DeletedInventoryFile = Readonly<{
  kind: "deleted";
  beforePath: string;
  afterPath: null;
}>;

type ChangedInventoryFile = Readonly<{
  kind: "changed";
  beforePath: string;
  afterPath: string;
}>;

type RenamedInventoryFile = Readonly<{
  kind: "renamed";
  beforePath: string;
  afterPath: string;
}>;

type InventoryFile =
  | AddedInventoryFile
  | DeletedInventoryFile
  | ChangedInventoryFile
  | RenamedInventoryFile;

type FileConversionInput<File extends InventoryFile> = Readonly<{
  context: ComparisonContext;
  file: File;
  addedLines: readonly number[];
}>;

const toAddedComparisonFile = async ({
  context,
  file,
  addedLines,
}: FileConversionInput<AddedInventoryFile>): Promise<AddedComparisonFile> => {
  return {
    kind: "added",
    beforePath: null,
    afterPath: file.afterPath,
    beforeSource: null,
    afterSource: await readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.headCommit,
      path: file.afterPath,
    }),
    addedLines,
    firstAddedLine: addedLines[0] ?? null,
  };
};

const toDeletedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<DeletedInventoryFile>): Promise<DeletedComparisonFile> => {
  return {
    kind: "deleted",
    beforePath: file.beforePath,
    afterPath: null,
    beforeSource: await readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.baseCommit,
      path: file.beforePath,
    }),
    afterSource: null,
    addedLines: [],
    firstAddedLine: null,
  };
};

const toChangedComparisonFile = async ({
  context,
  file,
  addedLines,
}: FileConversionInput<ChangedInventoryFile>): Promise<ChangedComparisonFile> => {
  const [beforeSource, afterSource] = await Promise.all([
    readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.baseCommit,
      path: file.beforePath,
    }),
    readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.headCommit,
      path: file.afterPath,
    }),
  ]);
  return {
    kind: "changed",
    beforePath: file.beforePath,
    afterPath: file.afterPath,
    beforeSource,
    afterSource,
    addedLines,
    firstAddedLine: addedLines[0] ?? null,
  };
};

const toRenamedComparisonFile = async ({
  context,
  file,
  addedLines,
}: FileConversionInput<RenamedInventoryFile>): Promise<RenamedComparisonFile> => {
  const [beforeSource, afterSource] = await Promise.all([
    readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.baseCommit,
      path: file.beforePath,
    }),
    readSource({
      repositoryRoot: context.repositoryRoot,
      revision: context.headCommit,
      path: file.afterPath,
    }),
  ]);
  return {
    kind: "renamed",
    beforePath: file.beforePath,
    afterPath: file.afterPath,
    beforeSource,
    afterSource,
    addedLines,
    firstAddedLine: addedLines[0] ?? null,
  };
};

const parsedTypeFor = (kind: InventoryFile["kind"]): AnyFileChange["type"] => {
  switch (kind) {
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

const toComparisonFile = ({
  context,
  inventoryFile,
  parsedFile,
}: Readonly<{
  context: ComparisonContext;
  inventoryFile: InventoryFile;
  parsedFile: AnyFileChange;
}>): Promise<ComparisonFile> => {
  const expectedType = parsedTypeFor(inventoryFile.kind);
  if (parsedFile.type !== expectedType) {
    throw new Error(`Git diff metadata and patch disagree: ${expectedType} != ${parsedFile.type}`);
  }

  const input = { context, file: inventoryFile, addedLines: addedLinesIn(parsedFile) };
  switch (inventoryFile.kind) {
    case "added":
      return toAddedComparisonFile({ ...input, file: inventoryFile });
    case "deleted":
      return toDeletedComparisonFile({ ...input, file: inventoryFile });
    case "changed":
      return toChangedComparisonFile({ ...input, file: inventoryFile });
    case "renamed":
      return toRenamedComparisonFile({ ...input, file: inventoryFile });
  }
};

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
    case "T":
      return { kind: "changed", beforePath: path, afterPath: path };
  }
  throw new Error("Unsupported Git diff status");
};

const nulCharacter = String.fromCodePoint(0);
const inventoryRecordPattern = new RegExp(
  `(?:([ADMT])${nulCharacter}([^${nulCharacter}]+)${nulCharacter}|R(100|0\\d{2})${nulCharacter}([^${nulCharacter}]+)${nulCharacter}([^${nulCharacter}]+)${nulCharacter})`,
  "guy",
);

const parseDiffInventory = (output: string): readonly InventoryFile[] => {
  const matches = Array.from(output.matchAll(inventoryRecordPattern));
  const parsedLength = matches.reduce((length, match) => length + match[0].length, 0);
  if (parsedLength !== output.length) {
    throw new Error("Invalid NUL-delimited Git diff metadata");
  }
  return matches.map(inventoryFileFor);
};

const diffArguments = ({
  baseCommit,
  headCommit,
  presentation,
}: Readonly<{
  baseCommit: string;
  headCommit: string;
  presentation: readonly string[];
}>): readonly string[] => [
  "-c",
  "core.quotePath=false",
  "-c",
  "diff.renameLimit=0",
  "diff",
  "--default-prefix",
  "--find-renames",
  "--no-ext-diff",
  "--no-color",
  "--no-textconv",
  ...presentation,
  baseCommit,
  headCommit,
  "--",
];

export const compareRevisions = async ({
  repositoryRoot,
  baseRevision,
  headRevision,
}: CompareRevisionsOptions): Promise<RepositoryComparison> => {
  const [baseCommit, headCommit] = await Promise.all([
    resolveCommit(repositoryRoot, baseRevision),
    resolveCommit(repositoryRoot, headRevision),
  ]);
  const [inventoryOutput, diff] = await Promise.all([
    runGitText(
      repositoryRoot,
      diffArguments({ baseCommit, headCommit, presentation: ["--name-status", "-z"] }),
    ),
    runGitText(
      repositoryRoot,
      diffArguments({ baseCommit, headCommit, presentation: ["--unified=0"] }),
    ),
  ]);
  const inventory = parseDiffInventory(inventoryOutput);
  const parsed = parseRepositoryDiff(diff);
  if (inventory.length !== parsed.files.length) {
    throw new Error(
      `Git diff metadata and patch file counts disagree: ${inventory.length} != ${parsed.files.length}`,
    );
  }

  const context = { repositoryRoot, baseCommit, headCommit };
  const files = await Promise.all(
    inventory.map((inventoryFile, index) => {
      const parsedFile = parsed.files[index];
      if (parsedFile === undefined) {
        throw new Error("Git diff patch is missing an inventory file");
      }
      return toComparisonFile({ context, inventoryFile, parsedFile });
    }),
  );

  return {
    repositoryRoot,
    baseRevision,
    headRevision,
    files,
  };
};
