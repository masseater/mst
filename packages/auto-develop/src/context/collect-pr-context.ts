import { isDeletion, parseNameStatus, type ChangedFile } from "./name-status.ts";

import type { CommentContext, CiContext, PrContext } from "./pr-context.ts";

export type PrContextGithub = {
  readonly commentContext: (prNumber: number) => Promise<CommentContext>;
  readonly ciContext: (fetch: {
    readonly prNumber: number;
    readonly failedLogsDir: string;
  }) => Promise<CiContext>;
};

const MAX_CONTENT_BYTES = 1_000_000;

const GITLINK_MODE = "160000";

export type PrContextGit = {
  readonly nameStatusDiff: (ends: {
    readonly base: string;
    readonly head: string;
  }) => Promise<string>;
  readonly unifiedDiff: (ends: { readonly base: string; readonly head: string }) => Promise<string>;
  readonly treeEntryMode: (entry: {
    readonly ref: string;
    readonly path: string;
  }) => Promise<string | null>;
  readonly showFile: (entry: { readonly ref: string; readonly path: string }) => Promise<string>;
};

const resolveContent = async (resolve: {
  readonly git: PrContextGit;
  readonly head: string;
  readonly file: ChangedFile;
}): Promise<ChangedFile> => {
  const { git, head, file } = resolve;
  if (isDeletion(file.statusCode)) return { ...file, omissionReason: "deleted" };
  const spelledMode = await git.treeEntryMode({ ref: head, path: file.path });
  if (spelledMode === GITLINK_MODE) return { ...file, omissionReason: "submodule" };
  const writtenContent = await git.showFile({ ref: head, path: file.path });
  if (Buffer.byteLength(writtenContent, "utf8") > MAX_CONTENT_BYTES) {
    return { ...file, omissionReason: "too-large" };
  }
  return { ...file, content: writtenContent };
};

export const collectPrContext = async (collect: {
  readonly git: PrContextGit;
  readonly github: PrContextGithub;
  readonly prNumber: number;
  readonly base: string;
  readonly head: string;
  readonly failedLogsDir: string;
}): Promise<PrContext> => {
  const { git, github } = collect;
  const ends = { base: collect.base, head: collect.head };
  const [nameStatus, diff] = await Promise.all([git.nameStatusDiff(ends), git.unifiedDiff(ends)]);
  const changedFiles = await Promise.all(
    parseNameStatus(nameStatus).map((file) => resolveContent({ git, head: collect.head, file })),
  );
  const [comments, ci] = await Promise.all([
    github.commentContext(collect.prNumber),
    github.ciContext({ prNumber: collect.prNumber, failedLogsDir: collect.failedLogsDir }),
  ]);
  return {
    prNumber: collect.prNumber,
    base: collect.base,
    head: collect.head,
    diff,
    changedFiles,
    comments,
    ci,
  };
};
