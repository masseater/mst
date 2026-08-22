import { isPlainObject } from "es-toolkit";

import {
  comparisonFrom,
  decodedPreviousSource,
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

const GITHUB_COMPARISON_FILE_LIMIT = 300;

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

const fieldsFrom = (held: unknown, refusal: string): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(held)) {
    throw new Error(refusal);
  }
  return held;
};

const textFrom = (held: unknown, refusal: string): string => {
  if (typeof held !== "string") {
    throw new Error(refusal);
  }
  return held;
};

const optionalTextFrom = (held: unknown, refusal: string): string | undefined =>
  held === undefined ? undefined : textFrom(held, refusal);

const comparedFileFrom = (held: unknown): ComparedFile => {
  const fileFields = fieldsFrom(
    held,
    "Do not read a changed file the compare answered as something other than an object.",
  );
  return {
    filename: textFrom(
      fileFields.filename,
      "Do not read a changed file the compare answered without a path.",
    ),
    status: textFrom(
      fileFields.status,
      "Do not read a changed file the compare answered without a status.",
    ),
    previous_filename: optionalTextFrom(
      fileFields.previous_filename,
      "Do not read a former path the compare answered as something other than text.",
    ),
    patch: optionalTextFrom(
      fileFields.patch,
      "Do not read a patch the compare answered as something other than text.",
    ),
  };
};

const isChangedFileList = (held: unknown): held is readonly unknown[] => Array.isArray(held);

const comparedFilesFrom = (held: unknown): readonly ComparedFile[] => {
  if (!isChangedFileList(held)) {
    throw new Error(
      "Do not read the changed files the compare answered as something other than a list.",
    );
  }
  return held.map(comparedFileFrom);
};

const completeFilesFrom = (held: unknown): readonly ComparedFile[] => {
  if (held === undefined) {
    throw new Error("Do not read a GitHub comparison answered without a changed-file inventory.");
  }
  const files = comparedFilesFrom(held);
  if (files.length >= GITHUB_COMPARISON_FILE_LIMIT) {
    throw new Error(
      "Do not read past a GitHub comparison whose changed-file inventory may be truncated at GitHub's 300-file comparison limit.",
    );
  }
  return files;
};

const comparedFrom = (
  carried: unknown,
): Readonly<{ mergeBaseRevision: string; files: readonly ComparedFile[] }> => {
  const compareFields = fieldsFrom(
    carried,
    "Do not read a compare the API answered as something other than an object.",
  );
  const mergeBaseFields = fieldsFrom(
    compareFields.merge_base_commit,
    "Do not read a compare the API answered without its merge base commit.",
  );
  return {
    mergeBaseRevision: textFrom(
      mergeBaseFields.sha,
      "Do not read a merge base commit the compare answered without a revision.",
    ),
    files: completeFilesFrom(compareFields.files),
  };
};

const encodedRepositoryPath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/");

const decodedContent = (carried: unknown): Uint8Array => {
  const contentsFields = fieldsFrom(
    carried,
    "Do not read a file the contents API answered as something other than an object.",
  );
  const encodedSource = textFrom(
    contentsFields.content,
    "Do not read a file the contents API answered without content.",
  );
  const encoding = textFrom(
    contentsFields.encoding,
    "Do not read a file the contents API answered without an encoding.",
  );
  if (encoding !== "base64") {
    throw new Error(`Do not read a file the contents API answered with ${encoding} encoding.`);
  }
  return Buffer.from(encodedSource, "base64");
};

export const compareGitHubPullRequest = async ({
  repositoryRoot,
  repository,
  baseRevision,
  headRevision,
  request,
}: GitHubPullRequestComparison): Promise<RepositoryComparison> => {
  const { mergeBaseRevision, files } = comparedFrom(
    await request(
      `/repos/${repository}/compare/${encodeURIComponent(baseRevision)}...${encodeURIComponent(headRevision)}`,
    ),
  );
  const contentsAt =
    (revision: string, decode: (path: string, sourceBytes: Uint8Array) => string | null) =>
    async (path: string) =>
      decode(
        path,
        decodedContent(
          await request(
            `/repos/${repository}/contents/${encodedRepositoryPath(path)}?ref=${encodeURIComponent(revision)}`,
          ),
        ),
      );

  return {
    repositoryRoot,
    baseRevision: mergeBaseRevision,
    headRevision,
    files: await comparisonFrom({
      inventoryOutput: files.map(inventoryEntryOf).join(""),
      diff: files.map(patchEntryOf).join(""),
      sources: {
        base: contentsAt(mergeBaseRevision, (_path, sourceBytes) =>
          decodedPreviousSource(sourceBytes),
        ),
        head: contentsAt(headRevision, decodedSource),
      },
    }),
  };
};
