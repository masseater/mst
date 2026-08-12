import { AUTHOR_STATUS_CONTEXT, type HandlerGithubClient } from "./github-client.ts";
import { createStatusWriter, type StatusWriter } from "./status-writer.ts";

import type { Logger } from "../logging/logger.ts";

const AUTHOR_REASONS = ["request_changes", "ci_failure", "merge_conflict", "base_update"] as const;

export type AuthorReason = (typeof AUTHOR_REASONS)[number];

export type AuthorHandlerConfig = {
  readonly github: HandlerGithubClient;
  readonly runSession: (session: {
    readonly prNumber: number;
    readonly headBranch: string;
    readonly reason: AuthorReason;
  }) => Promise<void>;
  readonly reviewerLogin: string;
  readonly dryRun: boolean;
  readonly log: Logger;
};

const requestRereview = async (rerequest: {
  readonly config: AuthorHandlerConfig;
  readonly statusWriter: StatusWriter;
  readonly prNumber: number;
  readonly sha: string;
}): Promise<void> => {
  try {
    await rerequest.config.github.requestReviewers({
      prNumber: rerequest.prNumber,
      logins: [rerequest.config.reviewerLogin],
    });
  } catch (requestFailure) {
    await rerequest.statusWriter.write({
      sha: rerequest.sha,
      state: "failure",
      description: "re-requesting the reviewer failed",
    });
    throw requestFailure;
  }
};

const runSessionWithStatus = async (running: {
  readonly config: AuthorHandlerConfig;
  readonly statusWriter: StatusWriter;
  readonly delivered: { readonly prNumber: number; readonly reason: AuthorReason };
  readonly headBranch: string;
}): Promise<void> => {
  const { config, delivered } = running;
  try {
    await config.runSession({
      prNumber: delivered.prNumber,
      headBranch: running.headBranch,
      reason: delivered.reason,
    });
  } catch (sessionFailure) {
    const failed = await config.github.prSnapshot(delivered.prNumber);
    await running.statusWriter.write({
      sha: failed.headRefOid,
      state: "failure",
      description: "the author response failed",
    });
    throw sessionFailure;
  }
};

export const createAuthorHandler = (config: AuthorHandlerConfig) => {
  return async (delivered: {
    readonly prNumber: number;
    readonly reason: AuthorReason;
  }): Promise<void> => {
    if (config.dryRun) {
      config.log.info(delivered, "dry run; skipping the author session");
      return;
    }
    const statusWriter = createStatusWriter({
      github: config.github,
      context: AUTHOR_STATUS_CONTEXT,
      log: config.log,
    });
    const before = await config.github.prSnapshot(delivered.prNumber);
    await statusWriter.write({
      sha: before.headRefOid,
      state: "pending",
      description: "addressing feedback",
    });
    await runSessionWithStatus({
      config,
      statusWriter,
      delivered,
      headBranch: before.headRefName,
    });
    const after = await config.github.prSnapshot(delivered.prNumber);
    await statusWriter.write({
      sha: after.headRefOid,
      state: "success",
      description: "the author response completed",
    });
    await requestRereview({
      config,
      statusWriter,
      prNumber: delivered.prNumber,
      sha: after.headRefOid,
    });
  };
};
