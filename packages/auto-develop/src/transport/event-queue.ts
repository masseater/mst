export type EventQueue = {
  readonly enqueue: (flattened: Readonly<Record<string, unknown>>) => void;
  readonly take: () => Readonly<Record<string, unknown>> | null;
  readonly wake: () => void;
  readonly waitForWake: () => Promise<void>;
};

export const createEventQueue = (): EventQueue => {
  const pendingEvents = new Map<number, Readonly<Record<string, unknown>>>();
  const queueCounters = new Map<string, number>([
    ["head", 0],
    ["tail", 0],
  ]);
  const waiters = new Set<() => void>();
  const wake = (): void => {
    for (const wakeWaiter of waiters) wakeWaiter();
    waiters.clear();
  };
  return {
    wake,
    waitForWake: () => new Promise<void>((resolve) => waiters.add(resolve)),
    enqueue: (flattened) => {
      const tail = queueCounters.get("tail") as number;
      pendingEvents.set(tail, flattened);
      queueCounters.set("tail", tail + 1);
      wake();
    },
    take: () => {
      const head = queueCounters.get("head") as number;
      if (head >= (queueCounters.get("tail") as number)) return null;
      const queued = pendingEvents.get(head) as Readonly<Record<string, unknown>>;
      pendingEvents.delete(head);
      queueCounters.set("head", head + 1);
      return queued;
    },
  };
};
