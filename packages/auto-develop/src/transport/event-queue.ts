export type EventQueue = {
  readonly enqueue: (flattened: Readonly<Record<string, unknown>>) => void;
  readonly take: () => Readonly<Record<string, unknown>> | null;
  readonly wake: () => void;
  readonly waitForWake: () => Promise<void>;
};

class BufferedEventQueue {
  #buffered: readonly Readonly<Record<string, unknown>>[] = [];

  #waiters: readonly (() => void)[] = [];

  wake(): void {
    const woken = this.#waiters;
    this.#waiters = [];
    for (const wakeWaiter of woken) wakeWaiter();
  }

  waitForWake(): Promise<void> {
    return new Promise<void>((resolveWake) => {
      this.#waiters = [...this.#waiters, resolveWake];
    });
  }

  enqueue(flattened: Readonly<Record<string, unknown>>): void {
    this.#buffered = [...this.#buffered, flattened];
    const woken = this.#waiters;
    this.#waiters = [];
    for (const wakeWaiter of woken) wakeWaiter();
  }

  take(): Readonly<Record<string, unknown>> | null {
    const [oldest, ...remaining] = this.#buffered;
    if (oldest === undefined) return null;
    this.#buffered = remaining;
    return oldest;
  }
}

export const createEventQueue = (): EventQueue => new BufferedEventQueue();
