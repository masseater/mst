import {
  CHECK_SUITE_CONCLUSION,
  DECLARED_MODE,
  EXCLUSION_LABEL,
  REVIEW_STATE,
  type Mode,
} from "../contract/vocabulary.ts";
import { GITHUB_REVIEW_STATE } from "../lifecycle/review-verdict.ts";
import {
  CHECK_BUCKET,
  type CheckBucket,
  type GithubPullSummary,
  type GithubReader,
} from "./github-reader.ts";
import { startupDrainDeliveryId, synthesizeEnvelope } from "./synth.ts";

import type { EventEnvelope } from "../contract/envelope.ts";

const reviewRequestedEnvelope = (pull: GithubPullSummary): EventEnvelope =>
  synthesizeEnvelope({
    filtered: {
      kind: "review-requested",
      pullNumber: pull.number,
      title: pull.title,
      draft: pull.draft,
    },
    deliveryId: startupDrainDeliveryId({
      eventType: "pull_request",
      detail: `${pull.number}:${pull.headSha}:review-requested`,
    }),
    authorLogin: pull.authorLogin,
  });

const changesRequestedEnvelope = (pull: GithubPullSummary): EventEnvelope =>
  synthesizeEnvelope({
    filtered: {
      kind: "source-review-submitted",
      pullNumber: pull.number,
      state: REVIEW_STATE.changesRequested,
      body: "",
    },
    deliveryId: startupDrainDeliveryId({
      eventType: "pull_request_review",
      detail: `${pull.number}:${pull.headSha}:changes_requested`,
    }),
    authorLogin: pull.authorLogin,
  });

const mergeConflictEnvelope = (pull: GithubPullSummary): EventEnvelope =>
  synthesizeEnvelope({
    filtered: { kind: "merge-conflict", pullNumber: pull.number },
    deliveryId: startupDrainDeliveryId({
      eventType: "pull_request",
      detail: `${pull.number}:${pull.baseSha}:${pull.headSha}:merge-conflict`,
    }),
    authorLogin: pull.authorLogin,
  });

const baseUpdateEnvelope = (pull: GithubPullSummary): EventEnvelope =>
  synthesizeEnvelope({
    filtered: { kind: "base-update", pullNumber: pull.number },
    deliveryId: startupDrainDeliveryId({
      eventType: "pull_request",
      detail: `${pull.number}:${pull.baseSha}:${pull.headSha}:base-update`,
    }),
    authorLogin: pull.authorLogin,
  });

const ciFailureEnvelope = (pull: GithubPullSummary): EventEnvelope =>
  synthesizeEnvelope({
    filtered: {
      kind: "ci-completed",
      pullNumber: pull.number,
      conclusion: CHECK_SUITE_CONCLUSION.failure,
      headSha: pull.headSha,
    },
    deliveryId: startupDrainDeliveryId({
      eventType: "check_suite",
      detail: `${pull.number}:${pull.headSha}:failure`,
    }),
    authorLogin: pull.authorLogin,
  });

export const indicatesSummaryConflict = (pull: GithubPullSummary): boolean =>
  pull.mergeable === "CONFLICTING" || pull.mergeStateStatus === "DIRTY";

/** @canonical-values auto-develop.check-fold-verdict */
const CHECK_FOLD_VERDICTS = ["success", "pending", "failure", "none"] as const;

const CHECK_FOLD_VERDICT = {
  success: CHECK_FOLD_VERDICTS[0],
  pending: CHECK_FOLD_VERDICTS[1],
  failure: CHECK_FOLD_VERDICTS[2],
  none: CHECK_FOLD_VERDICTS[3],
} as const;

const foldCheckBuckets = (
  buckets: readonly CheckBucket[],
): (typeof CHECK_FOLD_VERDICTS)[number] => {
  if (buckets.length === 0) return CHECK_FOLD_VERDICT.success;
  if (buckets.includes(CHECK_BUCKET.pending)) return CHECK_FOLD_VERDICT.pending;
  if (buckets.includes(CHECK_BUCKET.fail)) return CHECK_FOLD_VERDICT.failure;
  if (buckets.includes(CHECK_BUCKET.cancel) || buckets.includes(CHECK_BUCKET.skipping)) {
    return CHECK_FOLD_VERDICT.none;
  }
  return CHECK_FOLD_VERDICT.success;
};

const authorWorkEnvelopes = async (work: {
  readonly pull: GithubPullSummary;
  readonly github: GithubReader;
  readonly ciSuppressionLabel: string | undefined;
}): Promise<readonly EventEnvelope[]> => {
  const { pull } = work;
  const buckets = await work.github.listCheckBuckets(pull.number);
  const ciSuppressed =
    work.ciSuppressionLabel !== undefined && pull.labelNames.includes(work.ciSuppressionLabel);
  return [
    ...(pull.reviewDecision === GITHUB_REVIEW_STATE.changesRequested
      ? [changesRequestedEnvelope(pull)]
      : []),
    ...(indicatesSummaryConflict(pull) ? [mergeConflictEnvelope(pull)] : []),
    ...(pull.mergeStateStatus === "BEHIND" ? [baseUpdateEnvelope(pull)] : []),
    ...(foldCheckBuckets(buckets) === CHECK_FOLD_VERDICT.failure && !ciSuppressed
      ? [ciFailureEnvelope(pull)]
      : []),
  ];
};

export const runStartupDrain = async (drain: {
  readonly login: string;
  readonly mode: Mode;
  readonly github: GithubReader;
  readonly ciSuppressionLabel: string | undefined;
}): Promise<readonly EventEnvelope[]> => {
  const openPulls = (await drain.github.listOpenPullRequests()).filter(
    (pull) => !pull.labelNames.includes(EXCLUSION_LABEL),
  );
  if (drain.mode === DECLARED_MODE.reviewer) {
    return openPulls
      .filter((pull) => pull.requestedReviewerLogins.includes(drain.login))
      .map(reviewRequestedEnvelope);
  }
  const authoredPulls = openPulls.filter((pull) => pull.authorLogin === drain.login);
  const envelopeGroups = await Promise.all(
    authoredPulls.map((pull) =>
      authorWorkEnvelopes({
        pull,
        github: drain.github,
        ciSuppressionLabel: drain.ciSuppressionLabel,
      }),
    ),
  );
  return envelopeGroups.flat();
};
