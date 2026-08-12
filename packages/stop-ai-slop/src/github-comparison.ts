import {
  comparisonFrom,
  decodedSource,
  type RepositoryComparison,
} from "./repository-comparison.ts";

export type GitHubRequest = (path: string) => Promise<unknown>;

export type GitHubPullRequestComparison = Readonly<{
  repositoryRoot: string;
  repository: string;
  baseRevision: string;
  headRevision: string;
  request: GitHubRequest;
}>;

type ComparedFile = Readonly<{
  filename: string;
  status: string;
  previous_filename?: string;
  patch?: string;
}>;

type Compared = Readonly<{
  merge_base_commit: Readonly<{ sha: string }>;
  files?: readonly ComparedFile[];
}>;

const movedFrom = (file: ComparedFile): string => {
  const before = file.previous_filename;
  if (before === undefined || before === "") {
    throw new Error(
      `Do not read a move the compare answered without its former path: ${file.filename}.`,
    );
  }
  return before;
};

type ChangeShape = Readonly<{
  inventory: (file: ComparedFile) => string;
  formerPath: (file: ComparedFile) => string;
  headers: (file: ComparedFile) => readonly string[];
}>;

const asAdded: ChangeShape = {
  inventory: (file) => `A\0${file.filename}\0`,
  formerPath: (file) => file.filename,
  headers: (file) => ["new file mode 100644", "--- /dev/null", `+++ b/${file.filename}`],
};

const asModified: ChangeShape = {
  inventory: (file) => `M\0${file.filename}\0`,
  formerPath: (file) => file.filename,
  headers: (file) => [`--- a/${file.filename}`, `+++ b/${file.filename}`],
};

const SHAPES_BY_STATUS: Readonly<Record<string, ChangeShape>> = {
  added: asAdded,
  changed: asModified,
  copied: asAdded,
  modified: asModified,
  removed: {
    inventory: (file) => `D\0${file.filename}\0`,
    formerPath: (file) => file.filename,
    headers: (file) => ["deleted file mode 100644", `--- a/${file.filename}`, "+++ /dev/null"],
  },
  renamed: {
    inventory: (file) => `R100\0${movedFrom(file)}\0${file.filename}\0`,
    formerPath: movedFrom,
    headers: (file) => [
      "similarity index 100%",
      `rename from ${movedFrom(file)}`,
      `rename to ${file.filename}`,
    ],
  },
};

const shapeOf = (file: ComparedFile): ChangeShape => {
  const shape = SHAPES_BY_STATUS[file.status];
  if (shape === undefined) {
    throw new Error(`Do not read past an unknown compare status "${file.status}".`);
  }
  return shape;
};

const inventoryEntryOf = (file: ComparedFile): string => shapeOf(file).inventory(file);

const patchEntryOf = (file: ComparedFile): string => {
  const shape = shapeOf(file);
  const lines = [
    `diff --git a/${shape.formerPath(file)} b/${file.filename}`,
    ...shape.headers(file),
    ...(file.patch === undefined ? [] : [file.patch.replace(/\n+$/u, "")]),
  ];
  return `${lines.join("\n")}\n`;
};

const comparedFrom = (carried: unknown): Compared => carried as Compared;

const decodedContent = (carried: unknown): Uint8Array => {
  const { content } = carried as Readonly<{ content?: string }>;
  if (content === undefined) {
    throw new Error("Do not read a file the contents API answered without content.");
  }
  return Buffer.from(content, "base64");
};

export const compareGitHubPullRequest = async ({
  repositoryRoot,
  repository,
  baseRevision,
  headRevision,
  request,
}: GitHubPullRequestComparison): Promise<RepositoryComparison> => {
  const compared = comparedFrom(
    await request(`/repos/${repository}/compare/${baseRevision}...${headRevision}`),
  );
  const files = compared.files ?? [];
  const mergeBase = compared.merge_base_commit.sha;
  const contentsAt = (revision: string) => async (path: string) =>
    decodedSource(
      path,
      decodedContent(
        await request(`/repos/${repository}/contents/${encodeURI(path)}?ref=${revision}`),
      ),
    );

  return {
    repositoryRoot,
    baseRevision: mergeBase,
    headRevision,
    files: await comparisonFrom({
      inventoryOutput: files.map(inventoryEntryOf).join(""),
      diff: files.map(patchEntryOf).join(""),
      sources: { base: contentsAt(mergeBase), head: contentsAt(headRevision) },
    }),
  };
};
