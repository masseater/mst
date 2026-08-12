import { prLaneOf } from "../queue/pr-lane.ts";

import type { FilteredEvent } from "../contract/filtered-event.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";

const PR_EVENT_JOB_TYPE = "pr-dispatched";

export type EventDispatcher = {
  readonly dispatch: (event: FilteredEvent) => boolean;
};

export const createEventDispatcher = (dispatcher: {
  readonly queue: JobQueue;
  readonly onPrClosed: (pullNumber: number) => void;
  readonly onExcluded: (pullNumber: number) => void;
  readonly log: Logger;
}): EventDispatcher => ({
  dispatch: (dispatched) => {
    if (dispatched.kind === "pr-closed") {
      dispatcher.onPrClosed(dispatched.pullNumber);
      return true;
    }
    if (dispatched.kind === "pr-excluded") {
      dispatcher.onExcluded(dispatched.pullNumber);
      return true;
    }
    const accepted = dispatcher.queue.enqueue({
      type: PR_EVENT_JOB_TYPE,
      payload: dispatched,
      key: dispatched.deliveryId ?? `${dispatched.kind}-${dispatched.pullNumber}`,
      lane: prLaneOf(dispatched.pullNumber),
      label: `${dispatched.kind} for PR #${dispatched.pullNumber}`,
    });
    if (!accepted) {
      dispatcher.log.info(
        { pullNumber: dispatched.pullNumber, kind: dispatched.kind },
        "the queue did not accept the dispatched",
      );
    }
    return accepted;
  },
});
