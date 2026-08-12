import { prLaneOf } from "../queue/pr-lane.ts";

import type { FilteredEvent } from "../contract/filtered-event.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";

const PR_EVENT_JOB_TYPE = "pr-event";

export type EventDispatcher = {
  readonly dispatch: (event: FilteredEvent) => boolean;
};

export const createEventDispatcher = (dispatcher: {
  readonly queue: JobQueue;
  readonly onPrClosed: (pullNumber: number) => void;
  readonly onExcluded: (pullNumber: number) => void;
  readonly log: Logger;
}): EventDispatcher => ({
  dispatch: (event) => {
    if (event.kind === "pr-closed") {
      dispatcher.onPrClosed(event.pullNumber);
      return true;
    }
    if (event.kind === "pr-excluded") {
      dispatcher.onExcluded(event.pullNumber);
      return true;
    }
    const accepted = dispatcher.queue.enqueue({
      type: PR_EVENT_JOB_TYPE,
      payload: event,
      key: event.deliveryId ?? `${event.kind}-${event.pullNumber}`,
      lane: prLaneOf(event.pullNumber),
      label: `${event.kind} for PR #${event.pullNumber}`,
    });
    if (!accepted) {
      dispatcher.log.info(
        { pullNumber: event.pullNumber, kind: event.kind },
        "the queue did not accept the event",
      );
    }
    return accepted;
  },
});
