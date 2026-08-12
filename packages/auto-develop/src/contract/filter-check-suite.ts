import { carriedDeliveryId } from "./delivery-id.ts";
import { asRecord } from "./unknown-record.ts";
import {
  isAuthorWorkConclusion,
  isCheckSuiteConclusion,
  type CheckSuiteConclusion,
  type Mode,
} from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

const completedSuiteShape = (
  event: Readonly<Record<string, unknown>>,
): {
  readonly conclusion: CheckSuiteConclusion;
  readonly headSha: string;
  readonly pullNumber: number;
} | null => {
  const checkSuite = asRecord(event.check_suite);
  const conclusion = checkSuite?.conclusion;
  const headSha = checkSuite?.head_sha;
  const pullRequests = checkSuite?.pull_requests;
  if (!isCheckSuiteConclusion(conclusion) || typeof headSha !== "string") return null;
  if (!Array.isArray(pullRequests)) return null;
  const pullNumber = asRecord(pullRequests[0])?.number;
  if (typeof pullNumber !== "number") return null;
  return { conclusion, headSha, pullNumber };
};

export const filterCheckSuiteEvent = (
  event: Readonly<Record<string, unknown>>,
  mode: Mode,
): FilteredEvent | null => {
  if (mode === "reviewer") return null;
  const suite = completedSuiteShape(event);
  if (suite === null || event.action !== "completed") return null;
  if (!isAuthorWorkConclusion(suite.conclusion)) return null;
  return {
    kind: "ci-completed",
    pullNumber: suite.pullNumber,
    conclusion: suite.conclusion,
    headSha: suite.headSha,
    ...carriedDeliveryId(event),
  };
};
