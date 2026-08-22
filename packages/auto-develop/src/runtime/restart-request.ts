const RESTART_REASONS = ["code-updated", "idle"] as const;

type RestartReason = (typeof RESTART_REASONS)[number];

const restartReasonOf = (aborted: unknown): RestartReason | null =>
  RESTART_REASONS.find((known) => known === aborted) ?? null;

export type RestartRequest = {
  readonly request: (reason: RestartReason) => void;
  readonly requested: () => RestartReason | null;
};

export const createRestartRequest = (latch: {
  readonly onRequest: (reason: RestartReason) => void;
}): RestartRequest => {
  const heldLatch = new AbortController();
  return {
    request: (reason) => {
      if (heldLatch.signal.aborted) return;
      heldLatch.abort(reason);
      latch.onRequest(reason);
    },
    requested: () => restartReasonOf(heldLatch.signal.reason),
  };
};

export const codeMovedOn = (check: {
  readonly startupCommit: string;
  readonly currentCommit: string | null;
}): boolean => check.currentCommit !== null && check.currentCommit !== check.startupCommit;
