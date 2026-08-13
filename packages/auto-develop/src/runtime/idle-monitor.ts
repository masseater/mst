export type IdleMonitor = {
  readonly recordActivity: () => void;
  readonly idleTooLong: () => boolean;
};

class ActivityStampedIdleMonitor implements IdleMonitor {
  readonly #thresholdMs: number;

  readonly #now: () => number;

  #lastActivityAtMs: number;

  constructor(monitor: {
    readonly startedAtMs: number;
    readonly thresholdMs: number;
    readonly now: () => number;
  }) {
    this.#thresholdMs = monitor.thresholdMs;
    this.#now = monitor.now;
    this.#lastActivityAtMs = monitor.startedAtMs;
  }

  readonly recordActivity = (): void => {
    this.#lastActivityAtMs = this.#now();
  };

  readonly idleTooLong = (): boolean => this.#now() - this.#lastActivityAtMs >= this.#thresholdMs;
}

export const createIdleMonitor = (monitor: {
  readonly startedAtMs: number;
  readonly thresholdMs: number;
  readonly now: () => number;
}): IdleMonitor => new ActivityStampedIdleMonitor(monitor);
