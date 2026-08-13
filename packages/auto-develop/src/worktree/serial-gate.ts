export type SerialGate = {
  readonly run: <TaskResult>(task: () => Promise<TaskResult>) => Promise<TaskResult>;
};

const settleQuietly = async (earlier: Promise<unknown>): Promise<void> => {
  try {
    await earlier;
  } catch (previousFailure) {
    void previousFailure;
  }
};

class ChainedSerialGate implements SerialGate {
  #tail: Promise<unknown> = Promise.resolve();

  readonly run = <TaskResult>(task: () => Promise<TaskResult>): Promise<TaskResult> => {
    const started = (async (): Promise<TaskResult> => {
      await settleQuietly(this.#tail);
      return task();
    })();
    this.#tail = started;
    return started;
  };
}

export const createSerialGate = (): SerialGate => new ChainedSerialGate();
