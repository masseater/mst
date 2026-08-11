import { asRecord } from "../contract/unknown-record.ts";

export const HALT_KEEP_JOB_DISPOSITION = "halt-keep-job";

export class HaltQueueKeepJobError extends Error {
  override readonly name: string = "HaltQueueKeepJobError";

  readonly queueDisposition = HALT_KEEP_JOB_DISPOSITION;

  constructor(reason: string, options?: { readonly cause?: unknown }) {
    super(reason, options);
  }
}

export const carriesHaltDisposition = (failure: unknown): boolean =>
  asRecord(failure)?.queueDisposition === HALT_KEEP_JOB_DISPOSITION ||
  (failure instanceof Error &&
    asRecord(failure.cause)?.queueDisposition === HALT_KEEP_JOB_DISPOSITION);
