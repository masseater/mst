import { extname } from "node:path";

import { runGitBuffer, runGitText } from "./git-text.ts";
import { parseRepositoryChanges, type RepositoryChange } from "./repository-diff.ts";

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

const resolveCommit = async (repositoryRoot: string, revision: string): Promise<string> =>
  (
    await runGitText({
      repositoryRoot,
      args: ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
    })
  ).trim();

const sourceExtensions = [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"];

export const decodedSource = (path: string, writtenBlob: Uint8Array): string => {
  if (writtenBlob.includes(0)) {
    throw new Error(`Source blob contains NUL bytes: ${path}`);
  }

  return new TextDecoder("utf-8").decode(writtenBlob);
};

export type SideSources = Readonly<{
  base: (path: string) => Promise<string>;
  head: (path: string) => Promise<string>;
}>;

const readSource = async ({
  sources,
  side,
  path,
}: Readonly<{
  sources: SideSources;
  side: keyof SideSources;
  path: string;
}>): Promise<string | null> =>
  sourceExtensions.includes(extname(path).toLowerCase()) ? sources[side](path) : null;

type FileConversionInput<File extends RepositoryChange> = Readonly<{
  context: Readonly<{ sources: SideSources }>;
  file: File;
}>;

const toAddedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<
  Extract<RepositoryChange, { kind: "added" }>
>): Promise<AddedComparisonFile> => {
  return {
    ...file,
    beforeSource: null,
    afterSource: await readSource({
      sources: context.sources,
      side: "head",
      path: file.afterPath,
    }),
    firstAddedLine: file.addedLines[0] ?? null,
  };
};

const toDeletedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<
  Extract<RepositoryChange, { kind: "deleted" }>
>): Promise<DeletedComparisonFile> => {
  return {
    ...file,
    beforeSource: await readSource({
      sources: context.sources,
      side: "base",
      path: file.beforePath,
    }),
    afterSource: null,
    firstAddedLine: null,
  };
};

const toTwoSidedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<Extract<RepositoryChange, { kind: "changed" | "renamed" }>>): Promise<
  ChangedComparisonFile | RenamedComparisonFile
> => {
  const [beforeSource, afterSource] = await Promise.all([
    readSource({ sources: context.sources, side: "base", path: file.beforePath }),
    readSource({ sources: context.sources, side: "head", path: file.afterPath }),
  ]);
  return {
    ...file,
    beforeSource,
    afterSource,
    firstAddedLine: file.addedLines[0] ?? null,
  };
};

const toComparisonFile = ({
  context,
  file,
}: FileConversionInput<RepositoryChange>): Promise<ComparisonFile> => {
  switch (file.kind) {
    case "added":
      return toAddedComparisonFile({ context, file });
    case "deleted":
      return toDeletedComparisonFile({ context, file });
    case "changed":
    case "renamed":
      return toTwoSidedComparisonFile({ context, file });
  }
};

export const comparisonFrom = async ({
  inventoryOutput,
  diff,
  sources,
}: Readonly<{
  inventoryOutput: string;
  diff: string;
  sources: SideSources;
}>): Promise<readonly ComparisonFile[]> =>
  Promise.all(
    parseRepositoryChanges({ inventoryOutput, diff }).map((file) =>
      toComparisonFile({ context: { sources }, file }),
    ),
  );

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
    runGitText({
      repositoryRoot,
      args: diffArguments({ baseCommit, headCommit, presentation: ["--name-status", "-z"] }),
    }),
    runGitText({
      repositoryRoot,
      args: diffArguments({ baseCommit, headCommit, presentation: ["--unified=0"] }),
    }),
  ]);
  const blobAt = (revision: string) => async (path: string) =>
    decodedSource(
      path,
      await runGitBuffer({
        repositoryRoot,
        args: ["cat-file", "blob", `${revision}:${path}`],
      }),
    );

  return {
    repositoryRoot,
    baseRevision,
    headRevision,
    files: await comparisonFrom({
      inventoryOutput,
      diff,
      sources: { base: blobAt(baseCommit), head: blobAt(headCommit) },
    }),
  };
};
