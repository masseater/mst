import type { ChangedFile } from "./name-status.ts";

export type ReviewThread = {
  readonly id: string;
  readonly resolved: boolean;
  readonly outdated: boolean;
  readonly path: string;
  readonly line: number | null;
  readonly comments: readonly {
    readonly id: string;
    readonly body: string;
    readonly author: string;
  }[];
};

export type CommentContext = {
  readonly reviews: readonly {
    readonly state: string;
    readonly body: string;
    readonly author: string;
  }[];
  readonly prComments: readonly { readonly body: string; readonly author: string }[];
  readonly inlineComments: readonly {
    readonly body: string;
    readonly path: string;
    readonly line: number;
    readonly author: string;
  }[];
  readonly threads: readonly ReviewThread[];
};

export type CiCheck = {
  readonly name: string;
  readonly state: string;
  readonly bucket: string;
  readonly detailsUrl: string | null;
  readonly workflowName: string;
};

export type CiContext = {
  readonly checks: readonly CiCheck[];
  readonly failedLogPaths: readonly string[];
};

export type PrContext = {
  readonly prNumber: number;
  readonly base: string;
  readonly head: string;
  readonly diff: string;
  readonly changedFiles: readonly ChangedFile[];
  readonly comments: CommentContext;
  readonly ci: CiContext;
};
