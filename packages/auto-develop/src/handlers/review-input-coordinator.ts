import { prLaneOf } from "../queue/pr-lane.ts";

import type { DiffEndpoint } from "../lifecycle/input-change.ts";
import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";

export type ReviewInputChangeEvent = {
  readonly prNumber: number;
  readonly endpoint: DiffEndpoint;
  readonly deliveryId?: string;
};

export type ReviewInputCoordinatorConfig = {
  readonly gate: LifecycleGate;
  readonly queue: JobQueue;
  readonly stopSession: (prNumber: number) => Promise<void>;
  readonly jobType: string;
  readonly log: Logger;
};

const interruptOrOpen = (interrupting: {
  readonly config: ReviewInputCoordinatorConfig;
  readonly prNumber: number;
  readonly running: boolean;
}): void => {
  if (interrupting.running) {
    interrupting.config.gate.interruptForInputChange(interrupting.prNumber);
    return;
  }
  interrupting.config.gate.openSignal(interrupting.prNumber);
};

const admits = (admitting: {
  readonly config: ReviewInputCoordinatorConfig;
  readonly event: ReviewInputChangeEvent;
  readonly lane: string;
}): boolean => {
  const { config, event } = admitting;
  if (config.gate.isClosed(event.prNumber)) {
    config.log.info(event, "review input change discarded; the PR is closed");
    return false;
  }
  if (!config.queue.admitsLane(admitting.lane)) {
    config.log.info(event, "review input change discarded; the lane is filtered out");
    return false;
  }
  return true;
};

export const createReviewInputCoordinator = (config: ReviewInputCoordinatorConfig) => {
  return async (event: ReviewInputChangeEvent): Promise<boolean> => {
    const lane = prLaneOf(event.prNumber);
    if (!admits({ config, event, lane })) return false;
    const running = config.queue.runningLanes().includes(lane);
    interruptOrOpen({ config, prNumber: event.prNumber, running });
    const accepted = config.queue.enqueueFollowUp({
      type: config.jobType,
      payload: event,
      key: event.deliveryId ?? config.jobType,
      lane,
      label: `review input change for PR #${event.prNumber}`,
    });
    if (!accepted) config.log.info(event, "the queue refused the follow-up review");
    if (running) await config.stopSession(event.prNumber);
    return accepted;
  };
};
