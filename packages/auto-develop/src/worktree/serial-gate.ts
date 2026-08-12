export type SerialGate = {
  readonly run: <TaskResult>(task: () => Promise<TaskResult>) => Promise<TaskResult>;
};

const settleQuietly = async (previous: Promise<unknown>): Promise<void> => {
  try {
    await previous;
  } catch (previousFailure) {
    void previousFailure;
  }
};

export const createSerialGate = (): SerialGate => {
  const chain = new Map<string, Promise<unknown>>([["tail", Promise.resolve()]]);
  const run = async <TaskResult>(task: () => Promise<TaskResult>): Promise<TaskResult> => {
    await settleQuietly(chain.get("tail") as Promise<unknown>);
    return task();
  };
  return {
    run: (task) => {
      const started = run(task);
      chain.set("tail", started);
      return started;
    },
  };
};
