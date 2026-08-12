const RESTART_REASONS = ["code-updated", "idle"] as const;

type RestartReason = (typeof RESTART_REASONS)[number];

export type RestartRequest = {
  readonly request: (reason: RestartReason) => void;
  readonly requested: () => RestartReason | null;
};

export const createRestartRequest = (latch: {
  readonly onRequest: (reason: RestartReason) => void;
}): RestartRequest => {
  const state = new Map<string, RestartReason>();
  return {
    request: (reason) => {
      if (state.has("reason")) return;
      state.set("reason", reason);
      latch.onRequest(reason);
    },
    requested: () => state.get("reason") ?? null,
  };
};

export const codeMovedOn = (check: {
  readonly startupCommit: string;
  readonly currentCommit: string | null;
}): boolean => check.currentCommit !== null && check.currentCommit !== check.startupCommit;
