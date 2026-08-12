export type IdleMonitor = {
  readonly recordActivity: () => void;
  readonly idleTooLong: () => boolean;
};

export const createIdleMonitor = (monitor: {
  readonly startedAtMs: number;
  readonly thresholdMs: number;
  readonly now: () => number;
}): IdleMonitor => {
  const lastActivity = new Map<string, number>();
  return {
    recordActivity: () => {
      lastActivity.set("at", monitor.now());
    },
    idleTooLong: () =>
      monitor.now() - (lastActivity.get("at") ?? monitor.startedAtMs) >= monitor.thresholdMs,
  };
};
