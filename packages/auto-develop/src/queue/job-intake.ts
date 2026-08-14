import { laneAdmitted, type PrFilter } from "./pr-lane.ts";

import type { Logger } from "../logging/logger.ts";
import type { JobExecution } from "./job-execution.ts";
import type { JobLedger, JobRecord } from "./job-ledger.ts";

export type CoalesceTable = Readonly<
  Record<string, (existingPayload: unknown, incomingPayload: unknown) => unknown>
>;

export type JobIntake = {
  readonly type: string;
  readonly payload: unknown;
  readonly key: string;
  readonly lane: string;
  readonly label: string;
};

export type JobIntakeDesk = {
  readonly enqueue: (intake: JobIntake) => boolean;
  readonly enqueueFollowUp: (intake: JobIntake) => boolean;
};

export const createJobIntakeDesk = (desk: {
  readonly ledger: JobLedger;
  readonly execution: JobExecution;
  readonly snapshotNow: () => void;
  readonly log: Logger;
  readonly coalesce: CoalesceTable;
  readonly waitingSerializedTypes: readonly string[];
  readonly prFilter: PrFilter | undefined;
  readonly nowIso: () => string;
  readonly nextId: () => string;
}): JobIntakeDesk => {
  const { ledger, execution, snapshotNow, log } = desk;

  const discardWith = (discarding: {
    readonly fields: Readonly<Record<string, unknown>>;
    readonly message: string;
  }): false => {
    log.info(discarding.fields, discarding.message);
    return false;
  };

  const mergeIntoWaiting = (merging: {
    readonly waitingJob: JobRecord;
    readonly intake: JobIntake;
    readonly merge: (existingPayload: unknown, incomingPayload: unknown) => unknown;
  }): void => {
    ledger.put({
      ...merging.waitingJob,
      payload: merging.merge(merging.waitingJob.payload, merging.intake.payload),
    });
    snapshotNow();
    log.info(
      { lane: merging.intake.lane, label: merging.intake.label },
      "job coalesced into waiting job",
    );
  };

  const acceptNew = (intake: JobIntake): void => {
    ledger.put({ ...intake, id: desk.nextId(), state: "waiting", acceptedAt: desk.nowIso() });
    snapshotNow();
    log.info({ key: intake.key, lane: intake.lane, label: intake.label }, "job accepted");
    execution.pump();
  };

  const acceptCoalescing = (coalescing: {
    readonly intake: JobIntake;
    readonly merge: (existingPayload: unknown, incomingPayload: unknown) => unknown;
  }): boolean => {
    const { intake } = coalescing;
    const waitingJob = ledger.findWaiting({ type: intake.type, lane: intake.lane });
    if (waitingJob !== undefined) {
      mergeIntoWaiting({ waitingJob, intake, merge: coalescing.merge });
      return true;
    }
    if (ledger.laneRunning(intake.lane)) {
      return discardWith({
        fields: { lane: intake.lane, label: intake.label },
        message: "job discarded; lane is running",
      });
    }
    acceptNew(intake);
    return true;
  };

  const normalDiscardReason = (
    intake: JobIntake,
  ): { readonly fields: Readonly<Record<string, unknown>>; readonly message: string } | null => {
    if (ledger.hasKey(intake.key)) {
      return {
        fields: { key: intake.key, label: intake.label },
        message: "job discarded; duplicate key",
      };
    }
    if (ledger.laneRunning(intake.lane)) {
      return {
        fields: { lane: intake.lane, label: intake.label },
        message: "job discarded; lane is running",
      };
    }
    if (ledger.laneWaiting(intake.lane) && !desk.waitingSerializedTypes.includes(intake.type)) {
      return {
        fields: { lane: intake.lane, label: intake.label },
        message: "job discarded; lane is waiting",
      };
    }
    return null;
  };

  const admitLane = (intake: JobIntake): boolean => {
    if (laneAdmitted({ lane: intake.lane, prFilter: desk.prFilter })) return true;
    log.info({ lane: intake.lane, label: intake.label }, "job rejected by the PR filter");
    return false;
  };

  return {
    enqueue: (intake) => {
      if (!admitLane(intake)) return false;
      const merge = desk.coalesce[intake.type];
      if (merge !== undefined) return acceptCoalescing({ intake, merge });
      const discardReason = normalDiscardReason(intake);
      if (discardReason !== null) return discardWith(discardReason);
      acceptNew(intake);
      return true;
    },
    enqueueFollowUp: (intake) => {
      if (!admitLane(intake)) return false;
      const waitingJob = ledger.findWaiting({ type: intake.type, lane: intake.lane });
      if (waitingJob !== undefined) {
        ledger.put({
          ...waitingJob,
          payload: intake.payload,
          key: intake.key,
          label: intake.label,
          acceptedAt: desk.nowIso(),
        });
        snapshotNow();
        log.info({ lane: intake.lane, label: intake.label }, "follow-up job replaced waiting job");
        return true;
      }
      acceptNew(intake);
      return true;
    },
  };
};
