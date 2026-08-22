import { filterCheckSuiteEvent } from "./filter-check-suite.ts";
import { filterPullRequestEvent } from "./filter-pull-request.ts";
import { filterReviewEvent } from "./filter-review.ts";

import type { FilteredEvent } from "./filtered-event.ts";
import type { Mode } from "./vocabulary.ts";

export const filterEvent = (
  delivered: Readonly<Record<string, unknown>>,
  spelledMode: Mode,
): FilteredEvent | null => {
  const eventType = delivered.event_type ?? delivered.type;
  if (eventType === "pull_request") return filterPullRequestEvent(delivered, spelledMode);
  if (eventType === "pull_request_review") return filterReviewEvent(delivered, spelledMode);
  if (eventType === "check_suite") return filterCheckSuiteEvent(delivered, spelledMode);
  return null;
};
