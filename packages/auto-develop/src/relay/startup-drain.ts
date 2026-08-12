import { EXCLUSION_LABEL, type Mode } from "../contract/vocabulary.ts";
import { startupDrainDeliveryId, synthesizeEnvelope } from "./synth.ts";

import type { EventEnvelope } from "../contract/envelope.ts";
import type { CheckBucket, GithubPullSummary, GithubReader } from "./github-reader.ts";

const foldCheckBuckets = (
  buckets: readonly CheckBucket[],
): "success" | "pending" | "failure" | "none" => {
  if (buckets.length === 0) return "success";
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("fail")) return "failure";
  if (buckets.includes("cancel") || buckets.includes("skipping")) return "none";
  return "success";
};

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
      state: "changes_requested",
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
      conclusion: "failure",
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
    ...(pull.reviewDecision === "CHANGES_REQUESTED" ? [changesRequestedEnvelope(pull)] : []),
    ...(indicatesSummaryConflict(pull) ? [mergeConflictEnvelope(pull)] : []),
    ...(pull.mergeStateStatus === "BEHIND" ? [baseUpdateEnvelope(pull)] : []),
    ...(foldCheckBuckets(buckets) === "failure" && !ciSuppressed ? [ciFailureEnvelope(pull)] : []),
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
  if (drain.mode === "reviewer") {
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
