import { prLaneOf } from "../queue/pr-lane.ts";

import type { DiffEndpoint } from "../lifecycle/input-change.ts";
import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";

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

export type ReviewInputChangeEvent = {
  readonly prNumber: number;
  readonly endpoint: DiffEndpoint;
  readonly deliveryId?: string;
};

const admits = (admitting: {
  readonly config: ReviewInputCoordinatorConfig;
  readonly changed: ReviewInputChangeEvent;
  readonly lane: string;
}): boolean => {
  const { config, changed } = admitting;
  if (config.gate.isClosed(changed.prNumber)) {
    config.log.info(changed, "review input change discarded; the PR is closed");
    return false;
  }
  if (!config.queue.admitsLane(admitting.lane)) {
    config.log.info(changed, "review input change discarded; the lane is filtered out");
    return false;
  }
  return true;
};

export const createReviewInputCoordinator = (config: ReviewInputCoordinatorConfig) => {
  return async (changed: ReviewInputChangeEvent): Promise<boolean> => {
    const lane = prLaneOf(changed.prNumber);
    if (!admits({ config, changed, lane })) return false;
    const running = config.queue.runningLanes().includes(lane);
    interruptOrOpen({ config, prNumber: changed.prNumber, running });
    const accepted = config.queue.enqueueFollowUp({
      type: config.jobType,
      payload: changed,
      key: changed.deliveryId ?? config.jobType,
      lane,
      label: `review input change for PR #${changed.prNumber}`,
    });
    if (!accepted) config.log.info(changed, "the queue refused the follow-up review");
    if (running) await config.stopSession(changed.prNumber);
    return accepted;
  };
};
