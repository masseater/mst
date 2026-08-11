import { filterCheckSuiteEvent } from "./filter-check-suite.ts";
import { filterPullRequestEvent } from "./filter-pull-request.ts";
import { filterReviewEvent } from "./filter-review.ts";

import type { FilteredEvent } from "./filtered-event.ts";
import type { Mode } from "./vocabulary.ts";

export const filterEvent = (
  event: Readonly<Record<string, unknown>>,
  mode: Mode,
): FilteredEvent | null => {
  const eventType = event.event_type ?? event.type;
  if (eventType === "pull_request") return filterPullRequestEvent(event, mode);
  if (eventType === "pull_request_review") return filterReviewEvent(event, mode);
  if (eventType === "check_suite") return filterCheckSuiteEvent(event, mode);
  return null;
};
