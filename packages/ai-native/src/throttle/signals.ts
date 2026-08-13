/** @canonical-values ai-native.interrupt-signal */
const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export const raiseSignal = (signal: NodeJS.Signals): void => {
  process.kill(process.pid, signal);
};

export const installInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.once(signal, takenHandler);
};

export const dropInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.removeListener(signal, takenHandler);
};

export const makeWaitingInterruptHandler = (dependencies: {
  entryPath: string;
  removeEntry: (entryPath: string) => void;
  raise: (signal: NodeJS.Signals) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    dependencies.removeEntry(dependencies.entryPath);
    dependencies.raise(signal);
  };
};

type HeldDependencies = {
  release: () => Promise<void>;
  raise: (signal: NodeJS.Signals) => void;
};

const releaseThenRaise = async (
  dependencies: HeldDependencies,
  signal: NodeJS.Signals,
): Promise<void> => {
  try {
    await dependencies.release();
  } catch (staleLease) {
    dependencies.raise(signal);
    return;
  }
  dependencies.raise(signal);
};

export const makeHeldInterruptHandler = (
  dependencies: HeldDependencies,
): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    void releaseThenRaise(dependencies, signal);
  };
};

export const makeRunningInterruptHandler = (dependencies: {
  childPid: number;
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Error | null;
  reportFailure: (failure: Error) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    const failure = dependencies.signalTree({ pid: dependencies.childPid, signal });
    if (failure !== null) dependencies.reportFailure(failure);
  };
};
