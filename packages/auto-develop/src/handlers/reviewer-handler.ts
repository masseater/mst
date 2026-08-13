import { changedEndpoint, type DiffEndpoint } from "../lifecycle/input-change.ts";
import { isReviewInputChanged } from "../lifecycle/review-input-changed-error.ts";
import { effectiveReviewOf, reviewVerdictState } from "../lifecycle/review-verdict.ts";
import {
  REVIEWER_STATUS_CONTEXT,
  type HandlerGithubClient,
  type PrSnapshot,
} from "./github-client.ts";
import { createStatusWriter, type StatusWriter } from "./status-writer.ts";

import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { Logger } from "../logging/logger.ts";

export type ReviewerHandlerConfig = {
  readonly github: HandlerGithubClient;
  readonly gate: LifecycleGate;
  readonly runSession: (session: {
    readonly prNumber: number;
    readonly headBranch: string;
    readonly baseBranch: string;
  }) => Promise<void>;
  readonly requestFollowUpReview: (request: {
    readonly prNumber: number;
    readonly endpoint: DiffEndpoint;
  }) => void;
  readonly dryRun: boolean;
  readonly proxyLogin?: string;
  readonly log: Logger;
};

const writeVerdict = async (verdict: {
  readonly config: ReviewerHandlerConfig;
  readonly statusWriter: StatusWriter;
  readonly prNumber: number;
  readonly sha: string;
}): Promise<void> => {
  const { config } = verdict;
  if (config.proxyLogin === undefined) {
    await verdict.statusWriter.write({
      sha: verdict.sha,
      state: "failure",
      description: "review failed; the reviewer login is unknown",
    });
    return;
  }
  const reviews = await config.github.listReviews(verdict.prNumber);
  const effectiveReview = effectiveReviewOf({ reviews, login: config.proxyLogin });
  const heldState = reviewVerdictState(effectiveReview);
  await verdict.statusWriter.write({
    sha: verdict.sha,
    state: heldState,
    description:
      heldState === "error" ? "review completed with changes requested" : "review completed",
  });
};

const followUpIfInputChanged = async (check: {
  readonly config: ReviewerHandlerConfig;
  readonly before: PrSnapshot;
}): Promise<PrSnapshot | null> => {
  const after = await check.config.github.prSnapshot(check.before.prNumber);
  const endpoint = changedEndpoint({ before: check.before, after });
  if (endpoint === null) return after;
  check.config.log.info(
    {
      prNumber: check.before.prNumber,
      endpoint,
      beforeBase: check.before.baseRefName,
      afterBase: after.baseRefName,
      beforeHead: check.before.headRefOid,
      afterHead: after.headRefOid,
    },
    "the review input changed; discarding the result and requesting a follow-up review",
  );
  check.config.requestFollowUpReview({ prNumber: check.before.prNumber, endpoint });
  return null;
};

const handleSessionFailure = async (failing: {
  readonly config: ReviewerHandlerConfig;
  readonly statusWriter: StatusWriter;
  readonly before: PrSnapshot;
  readonly failure: unknown;
}): Promise<void> => {
  const { config } = failing;
  if (isReviewInputChanged(failing.failure)) {
    config.log.info(
      { prNumber: failing.before.prNumber },
      "the review session was interrupted by a review input change",
    );
    return;
  }
  const after = await followUpIfInputChanged({ config, before: failing.before });
  if (after === null) return;
  const wrote = await failing.statusWriter.write({
    sha: after.headRefOid,
    state: "failure",
    description: "review failed",
  });
  if (wrote) throw failing.failure;
};

const reviewAfterStart = async (reviewing: {
  readonly config: ReviewerHandlerConfig;
  readonly statusWriter: StatusWriter;
  readonly before: PrSnapshot;
}): Promise<void> => {
  const { config, statusWriter, before } = reviewing;
  try {
    await config.runSession({
      prNumber: before.prNumber,
      headBranch: before.headRefName,
      baseBranch: before.baseRefName,
    });
  } catch (sessionFailure) {
    await handleSessionFailure({ config, statusWriter, before, failure: sessionFailure });
    return;
  }
  const after = await followUpIfInputChanged({ config, before });
  if (after === null) return;
  await writeVerdict({ config, statusWriter, prNumber: before.prNumber, sha: after.headRefOid });
};

export const createReviewerHandler = (config: ReviewerHandlerConfig) => {
  return async (prNumber: number): Promise<void> => {
    if (config.dryRun) {
      config.log.info({ prNumber }, "dry run; skipping the review session");
      return;
    }
    const generation = config.gate.generationOf(prNumber);
    const statusWriter = createStatusWriter({
      github: config.github,
      context: REVIEWER_STATUS_CONTEXT,
      log: config.log,
      guard: { gate: config.gate, prNumber, generation },
    });
    const before = await config.github.prSnapshot(prNumber);
    const started = await statusWriter.write({
      sha: before.headRefOid,
      state: "pending",
      description: "reviewing",
    });
    if (!started) return;
    await reviewAfterStart({ config, statusWriter, before });
  };
};
