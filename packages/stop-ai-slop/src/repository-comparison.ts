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

  const stdout = await runGitBuffer({
    repositoryRoot,
    args: ["cat-file", "blob", `${revision}:${path}`],
  });
  if (stdout.includes(0)) {
    throw new Error(`Source blob contains NUL bytes: ${path}`);
  }

  return new TextDecoder("utf-8").decode(stdout);
};

type FileConversionInput<File extends RepositoryChange> = Readonly<{
  context: Readonly<{
    repositoryRoot: string;
    baseCommit: string;
    headCommit: string;
  }>;
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
      repositoryRoot: context.repositoryRoot,
      revision: context.headCommit,
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
      repositoryRoot: context.repositoryRoot,
      revision: context.baseCommit,
      path: file.beforePath,
    }),
    afterSource: null,
    firstAddedLine: null,
  };
};

const toChangedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<
  Extract<RepositoryChange, { kind: "changed" }>
>): Promise<ChangedComparisonFile> => {
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
    ...file,
    beforeSource,
    afterSource,
    firstAddedLine: file.addedLines[0] ?? null,
  };
};

const toRenamedComparisonFile = async ({
  context,
  file,
}: FileConversionInput<
  Extract<RepositoryChange, { kind: "renamed" }>
>): Promise<RenamedComparisonFile> => {
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
      return toChangedComparisonFile({ context, file });
    case "renamed":
      return toRenamedComparisonFile({ context, file });
  }
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
    runGitText({
      repositoryRoot,
      args: diffArguments({ baseCommit, headCommit, presentation: ["--name-status", "-z"] }),
    }),
    runGitText({
      repositoryRoot,
      args: diffArguments({ baseCommit, headCommit, presentation: ["--unified=0"] }),
    }),
  ]);
  const context = { repositoryRoot, baseCommit, headCommit };
  const files = await Promise.all(
    parseRepositoryChanges({ inventoryOutput, diff }).map((file) =>
      toComparisonFile({ context, file }),
    ),
  );

  return {
    repositoryRoot,
    baseRevision,
    headRevision,
    files,
  };
};
